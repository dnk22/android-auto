from __future__ import annotations

import json
import logging
import math
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from app.schemas.caption_analyze_schema import (
    AudioAnalysis,
    AudioStreamSummary,
    CaptionAnalyzeFileInfo,
    CaptionAnalyzeResult,
    CaptionRecommendation,
    CaptionStreamsSummary,
    DetectedTextSample,
    SoftSubtitleInfo,
    SubtitleStreamSummary,
    VideoStreamSummary,
    VisualCaptionDetection,
)
from app.utils.subprocess_utils import CommandExecutionError, run_command

logger = logging.getLogger(__name__)


CHINESE_LANGUAGE_CODES = {"chi", "zho", "zh", "zh-cn", "zh-tw", "cmn", "yue"}


@dataclass(frozen=True)
class SampledFrame:
    path: Path
    timestamp_seconds: float


@dataclass(frozen=True)
class OcrTextResult:
    text: str
    confidence: float
    bbox: tuple[float, float, float, float] | None = None
    image_width: int | None = None
    image_height: int | None = None


class BaseOcrEngine(Protocol):
    enabled: bool

    def detect_text(self, image_path: Path) -> list[OcrTextResult]: ...


class NoopOcrEngine:
    enabled = False

    def detect_text(self, image_path: Path) -> list[OcrTextResult]:
        return []


class PaddleOcrEngine:
    enabled = True

    def __init__(self) -> None:
        from paddleocr import PaddleOCR

        self._ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)

    def detect_text(self, image_path: Path) -> list[OcrTextResult]:
        raw_results = self._ocr.ocr(str(image_path), cls=True)
        results: list[OcrTextResult] = []
        for page in raw_results or []:
            for item in page or []:
                if not item or len(item) < 2:
                    continue
                box = item[0]
                payload = item[1]
                if not payload or len(payload) < 2:
                    continue
                text = str(payload[0]).strip()
                try:
                    confidence = float(payload[1])
                except (TypeError, ValueError):
                    confidence = 0.0
                bbox = _bbox_from_points(box)
                results.append(OcrTextResult(text=text, confidence=confidence, bbox=bbox))
        return results


class EasyOcrEngine:
    enabled = True

    def __init__(self) -> None:
        import easyocr

        self._reader = easyocr.Reader(lang_list=["ch_sim", "ch_tra", "en"], gpu=False)

    def detect_text(self, image_path: Path) -> list[OcrTextResult]:
        raw_results = self._reader.readtext(str(image_path))
        results: list[OcrTextResult] = []
        for item in raw_results or []:
            if not item or len(item) < 3:
                continue
            box_points = item[0]
            text = str(item[1]).strip()
            try:
                confidence = float(item[2])
            except (TypeError, ValueError, IndexError):
                confidence = 0.0
            if not text or confidence < 0.0:
                continue
            bbox = _bbox_from_points(box_points)
            results.append(OcrTextResult(text=text, confidence=confidence, bbox=bbox))
        return results


def build_default_ocr_engine() -> BaseOcrEngine:
    try:
        return PaddleOcrEngine()
    except Exception as paddle_exc:
        logger.info("PaddleOCR failed, trying EasyOCR: %s", paddle_exc)
        try:
            return EasyOcrEngine()
        except Exception as easy_exc:
            logger.info("EasyOCR also failed, OCR is disabled: %s", easy_exc)
            return NoopOcrEngine()


def contains_chinese(text: str) -> bool:
    return chinese_char_ratio(text) > 0


def chinese_char_ratio(text: str) -> float:
    meaningful = [char for char in text if not char.isspace()]
    if not meaningful:
        return 0.0
    chinese_count = sum(1 for char in meaningful if _is_chinese_char(char))
    return chinese_count / len(meaningful)


class CaptionAnalyzeService:
    """Analyze whether an uploaded video contains soft, visual, or possible speech captions."""

    def __init__(
        self,
        *,
        ocr_engine: BaseOcrEngine | None = None,
        ffprobe_bin: str = "ffprobe",
        ffmpeg_bin: str = "ffmpeg",
        sample_count: int = 8,
    ) -> None:
        self._ocr_engine = ocr_engine if ocr_engine is not None else build_default_ocr_engine()
        self._ffprobe_bin = ffprobe_bin
        self._ffmpeg_bin = ffmpeg_bin
        self._sample_count = sample_count

    def analyze(self, video_path: str, filename: str, size_bytes: int) -> CaptionAnalyzeResult:
        errors: list[str] = []
        probe_result: dict[str, Any] = {}
        duration: float | None = None
        format_name: str | None = None

        try:
            probe_result = self.probe_video(video_path)
            duration = self._parse_duration(probe_result)
            format_name = self._parse_format_name(probe_result)
        except CommandExecutionError as exc:
            logger.warning("ffprobe failed for %s: %s", filename, exc)
            errors.append(str(exc))
            return self._unknown_result(
                filename=filename,
                size_bytes=size_bytes,
                duration=duration,
                format_name=format_name,
                errors=errors,
            )
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("ffprobe output is invalid for %s: %s", filename, exc)
            errors.append(str(exc))
            return self._unknown_result(
                filename=filename,
                size_bytes=size_bytes,
                duration=duration,
                format_name=format_name,
                errors=errors,
            )

        streams = self.get_stream_summary(probe_result)
        soft_subtitle = self.detect_soft_subtitle(streams)
        audio_analysis = self.analyze_audio(streams)
        visual_detection = VisualCaptionDetection(
            enabled=self._ocr_engine.enabled,
            sampled_frames=0,
            frames_with_text=0,
            detected_text_samples=[],
            is_chinese_likely=None,
        )

        should_sample = duration is not None and duration > 0 and not soft_subtitle.count
        if should_sample:
            with tempfile.TemporaryDirectory(prefix="caption-frames-") as output_dir:
                try:
                    frames = self.sample_frames(
                        video_path,
                        duration,
                        output_dir,
                        sample_count=self._sample_count,
                    )
                    visual_detection = self.detect_visual_text(frames)
                except CommandExecutionError as exc:
                    logger.warning("frame sampling failed for %s: %s", filename, exc)
                    errors.append(str(exc))

        classification = self.classify_caption(
            soft_subtitle=soft_subtitle,
            visual_detection=visual_detection,
            audio_analysis=audio_analysis,
            errors=errors,
        )
        recommendation = self.build_recommendation(classification["caption_type"])

        return CaptionAnalyzeResult(
            file=CaptionAnalyzeFileInfo(
                filename=filename,
                size_bytes=size_bytes,
                duration_seconds=duration,
                format_name=format_name,
            ),
            caption_type=classification["caption_type"],
            confidence=classification["confidence"],
            summary=classification["summary"],
            has_soft_subtitle=soft_subtitle.count > 0,
            has_hardcoded_visual_text=visual_detection.frames_with_text >= 2
            or (
                visual_detection.sampled_frames > 0
                and visual_detection.frames_with_text / visual_detection.sampled_frames >= 0.3
            ),
            has_audio=audio_analysis.has_audio_stream,
            has_speech_likely=audio_analysis.speech_likely,
            streams=streams,
            soft_subtitle=soft_subtitle,
            visual_caption_detection=visual_detection,
            audio_analysis=audio_analysis,
            recommendation=recommendation,
            errors=errors,
        )

    def probe_video(self, video_path: str) -> dict[str, Any]:
        completed = run_command(
            [
                self._ffprobe_bin,
                "-v",
                "error",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                video_path,
            ],
            timeout=30,
        )
        return json.loads(completed.stdout)

    def get_stream_summary(self, probe_result: dict[str, Any]) -> CaptionStreamsSummary:
        video: list[VideoStreamSummary] = []
        audio: list[AudioStreamSummary] = []
        subtitle: list[SubtitleStreamSummary] = []

        for stream in probe_result.get("streams") or []:
            if not isinstance(stream, dict):
                continue
            codec_type = stream.get("codec_type")
            tags = stream.get("tags") if isinstance(stream.get("tags"), dict) else {}
            index = int(stream.get("index") or 0)
            if codec_type == "video":
                video.append(
                    VideoStreamSummary(
                        index=index,
                        codec_name=stream.get("codec_name"),
                        width=_safe_int(stream.get("width")),
                        height=_safe_int(stream.get("height")),
                        avg_frame_rate=stream.get("avg_frame_rate"),
                    )
                )
            elif codec_type == "audio":
                audio.append(
                    AudioStreamSummary(
                        index=index,
                        codec_name=stream.get("codec_name"),
                        channels=_safe_int(stream.get("channels")),
                        sample_rate=str(stream.get("sample_rate")) if stream.get("sample_rate") else None,
                    )
                )
            elif codec_type == "subtitle":
                language = tags.get("language")
                title = tags.get("title")
                subtitle.append(
                    SubtitleStreamSummary(
                        index=index,
                        codec_name=stream.get("codec_name"),
                        language=language,
                        title=title,
                        is_chinese_likely=self._subtitle_is_chinese(language, title),
                    )
                )

        return CaptionStreamsSummary(video=video, audio=audio, subtitle=subtitle)

    def detect_soft_subtitle(self, streams: CaptionStreamsSummary) -> SoftSubtitleInfo:
        return SoftSubtitleInfo(count=len(streams.subtitle), streams=streams.subtitle)

    def sample_frames(
        self,
        video_path: str,
        duration: float,
        output_dir: str,
        sample_count: int = 8,
    ) -> list[SampledFrame]:
        if duration <= 0:
            return []

        count = min(sample_count, max(1, math.floor(duration)))
        ratios = self._sample_ratios(count)
        output_path = Path(output_dir)
        frames: list[SampledFrame] = []

        for index, ratio in enumerate(ratios, start=1):
            timestamp = max(0.1, min(duration * ratio, max(duration - 0.1, 0.1)))
            frame_path = output_path / f"frame_{index:02d}.jpg"
            run_command(
                [
                    self._ffmpeg_bin,
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-ss",
                    f"{timestamp:.3f}",
                    "-i",
                    video_path,
                    "-frames:v",
                    "1",
                    str(frame_path),
                ],
                timeout=15,
            )
            if frame_path.exists():
                frames.append(SampledFrame(path=frame_path, timestamp_seconds=timestamp))

        return frames

    def detect_visual_text(self, frames: list[SampledFrame]) -> VisualCaptionDetection:
        if not self._ocr_engine.enabled:
            return VisualCaptionDetection(
                enabled=False,
                sampled_frames=len(frames),
                frames_with_text=0,
                detected_text_samples=[],
                is_chinese_likely=None,
            )

        detected_samples: list[DetectedTextSample] = []
        frames_with_text = 0

        for frame in frames:
            image_width, image_height = _read_image_dimensions(frame.path)
            frame_results = self._ocr_engine.detect_text(frame.path)
            qualifying: list[DetectedTextSample] = []
            for result in frame_results:
                text = result.text.strip()
                if result.confidence < 0.5 or len(text) < 2:
                    continue
                width = result.image_width or image_width
                height = result.image_height or image_height
                region = self._detect_region(result.bbox, height)
                if region not in {"bottom", "middle"} and len(frames) > 1:
                    continue
                sample = DetectedTextSample(
                    timestamp_seconds=round(frame.timestamp_seconds, 3),
                    text=text,
                    confidence=round(result.confidence, 4),
                    bbox_area_ratio=self._bbox_area_ratio(result.bbox, width, height),
                    region=region,
                )
                qualifying.append(sample)
            if qualifying:
                frames_with_text += 1
                detected_samples.extend(qualifying[:3])

        chinese_samples = [sample for sample in detected_samples if contains_chinese(sample.text)]
        return VisualCaptionDetection(
            enabled=True,
            sampled_frames=len(frames),
            frames_with_text=frames_with_text,
            detected_text_samples=detected_samples[:20],
            is_chinese_likely=bool(detected_samples) and len(chinese_samples) >= max(1, len(detected_samples) // 2),
        )

    def analyze_audio(self, streams: CaptionStreamsSummary) -> AudioAnalysis:
        has_audio = len(streams.audio) > 0
        return AudioAnalysis(
            has_audio_stream=has_audio,
            speech_detection_enabled=False,
            speech_likely=None,
            note="Speech detection not enabled. Use faster-whisper/VAD later if needed."
            if has_audio
            else "No audio stream detected.",
        )

    def classify_caption(
        self,
        *,
        soft_subtitle: SoftSubtitleInfo,
        visual_detection: VisualCaptionDetection,
        audio_analysis: AudioAnalysis,
        errors: list[str],
    ) -> dict[str, Any]:
        if soft_subtitle.count > 0:
            return {
                "caption_type": "soft_subtitle",
                "confidence": 0.95,
                "summary": f"Video has {soft_subtitle.count} embedded subtitle stream.",
            }

        has_visual = visual_detection.frames_with_text >= 2 or (
            visual_detection.sampled_frames > 0
            and visual_detection.frames_with_text / visual_detection.sampled_frames >= 0.3
        )
        if has_visual:
            ratio = visual_detection.frames_with_text / max(visual_detection.sampled_frames, 1)
            avg_confidence = self._average_detection_confidence(visual_detection.detected_text_samples)
            confidence = min(0.9, max(0.55, 0.45 + ratio * 0.3 + avg_confidence * 0.2))
            return {
                "caption_type": "hardcoded_visual_caption",
                "confidence": round(confidence, 2),
                "summary": f"OCR detected caption-like text in {visual_detection.frames_with_text}/{visual_detection.sampled_frames} sampled frames.",
            }

        if audio_analysis.has_audio_stream:
            return {
                "caption_type": "speech_caption_possible",
                "confidence": 0.55,
                "summary": "No subtitle or clear OCR text found, but the video has audio so ASR may create captions.",
            }

        if errors:
            return {
                "caption_type": "unknown",
                "confidence": 0.2,
                "summary": "Caption analysis finished with partial errors.",
            }

        return {
            "caption_type": "no_caption_detected",
            "confidence": 0.8,
            "summary": "No subtitle stream, visual caption text, or audio stream detected.",
        }

    def build_recommendation(self, caption_type: str) -> CaptionRecommendation:
        mapping = {
            "soft_subtitle": (
                "extract_soft_subtitle",
                "Subtitle stream exists, so extract and translate subtitle directly.",
            ),
            "hardcoded_visual_caption": (
                "ocr_extract_timeline_then_translate",
                "Caption-like text is embedded in video frames.",
            ),
            "speech_caption_possible": (
                "run_asr_then_translate",
                "Audio exists, so ASR can be used to generate captions.",
            ),
            "no_caption_detected": (
                "no_caption_processing_needed",
                "No caption signal was detected.",
            ),
            "unknown": (
                "manual_review",
                "Analysis could not produce a reliable result.",
            ),
        }
        next_step, reason = mapping.get(caption_type, mapping["unknown"])
        return CaptionRecommendation(next_step=next_step, reason=reason)

    def _unknown_result(
        self,
        *,
        filename: str,
        size_bytes: int,
        duration: float | None,
        format_name: str | None,
        errors: list[str],
    ) -> CaptionAnalyzeResult:
        streams = CaptionStreamsSummary()
        audio_analysis = AudioAnalysis(
            has_audio_stream=False,
            speech_detection_enabled=False,
            speech_likely=None,
            note="Audio analysis skipped because ffprobe failed.",
        )
        return CaptionAnalyzeResult(
            file=CaptionAnalyzeFileInfo(
                filename=filename,
                size_bytes=size_bytes,
                duration_seconds=duration,
                format_name=format_name,
            ),
            caption_type="unknown",
            confidence=0.1,
            summary="Could not read enough video metadata to analyze captions.",
            has_soft_subtitle=False,
            has_hardcoded_visual_text=False,
            has_audio=False,
            has_speech_likely=None,
            streams=streams,
            soft_subtitle=SoftSubtitleInfo(count=0, streams=[]),
            visual_caption_detection=VisualCaptionDetection(
                enabled=self._ocr_engine.enabled,
                sampled_frames=0,
                frames_with_text=0,
                detected_text_samples=[],
                is_chinese_likely=None,
            ),
            audio_analysis=audio_analysis,
            recommendation=self.build_recommendation("unknown"),
            errors=errors,
        )

    def _parse_duration(self, probe_result: dict[str, Any]) -> float | None:
        raw_duration = (probe_result.get("format") or {}).get("duration")
        if raw_duration is None:
            return None
        try:
            return round(float(raw_duration), 3)
        except (TypeError, ValueError):
            return None

    def _parse_format_name(self, probe_result: dict[str, Any]) -> str | None:
        raw_format = (probe_result.get("format") or {}).get("format_name")
        return str(raw_format) if raw_format else None

    def _subtitle_is_chinese(self, language: str | None, title: str | None) -> bool:
        language_value = (language or "").strip().lower()
        title_value = (title or "").strip().lower()
        return language_value in CHINESE_LANGUAGE_CODES or "chinese" in title_value or contains_chinese(title or "")

    def _sample_ratios(self, count: int) -> list[float]:
        default = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]
        if count <= len(default):
            return default[:count]
        return [(index + 1) / (count + 1) for index in range(count)]

    def _detect_region(
        self,
        bbox: tuple[float, float, float, float] | None,
        image_height: int | None,
    ) -> str:
        if bbox is None or not image_height:
            return "full"
        _, y1, _, y2 = bbox
        center_y = (y1 + y2) / 2
        if center_y >= image_height * 0.6:
            return "bottom"
        if center_y >= image_height * 0.3:
            return "middle"
        return "top"

    def _bbox_area_ratio(
        self,
        bbox: tuple[float, float, float, float] | None,
        image_width: int | None,
        image_height: int | None,
    ) -> float | None:
        if bbox is None or not image_width or not image_height:
            return None
        x1, y1, x2, y2 = bbox
        area = max(0.0, x2 - x1) * max(0.0, y2 - y1)
        return round(area / max(float(image_width * image_height), 1.0), 4)

    def _average_detection_confidence(self, samples: list[DetectedTextSample]) -> float:
        if not samples:
            return 0.0
        return sum(sample.confidence for sample in samples) / len(samples)


def _safe_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _is_chinese_char(char: str) -> bool:
    return "\u4e00" <= char <= "\u9fff" or "\u3400" <= char <= "\u4dbf" or "\uf900" <= char <= "\ufaff"


def _bbox_from_points(points: Any) -> tuple[float, float, float, float] | None:
    try:
        xs = [float(point[0]) for point in points]
        ys = [float(point[1]) for point in points]
    except (TypeError, ValueError, IndexError):
        return None
    if not xs or not ys:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def _read_image_dimensions(image_path: Path) -> tuple[int | None, int | None]:
    try:
        data = image_path.read_bytes()
    except OSError:
        return None, None

    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        width = int.from_bytes(data[16:20], "big")
        height = int.from_bytes(data[20:24], "big")
        return width, height

    if not data.startswith(b"\xff\xd8"):
        return None, None

    index = 2
    while index + 9 < len(data):
        if data[index] != 0xFF:
            index += 1
            continue
        marker = data[index + 1]
        index += 2
        if marker in {0xD8, 0xD9}:
            continue
        if index + 2 > len(data):
            break
        segment_length = int.from_bytes(data[index:index + 2], "big")
        if segment_length < 2 or index + segment_length > len(data):
            break
        if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
            height = int.from_bytes(data[index + 3:index + 5], "big")
            width = int.from_bytes(data[index + 5:index + 7], "big")
            return width, height
        index += segment_length

    return None, None
