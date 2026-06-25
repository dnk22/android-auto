from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


CaptionType = Literal[
    "soft_subtitle",
    "hardcoded_visual_caption",
    "speech_caption_possible",
    "no_caption_detected",
    "unknown",
]


class CaptionAnalyzeFileInfo(BaseModel):
    filename: str
    size_bytes: int = Field(alias="size_bytes")
    duration_seconds: float | None = Field(default=None, alias="duration_seconds")
    format_name: str | None = Field(default=None, alias="format_name")


class VideoStreamSummary(BaseModel):
    index: int
    codec_name: str | None = None
    width: int | None = None
    height: int | None = None
    avg_frame_rate: str | None = None


class AudioStreamSummary(BaseModel):
    index: int
    codec_name: str | None = None
    channels: int | None = None
    sample_rate: str | None = None


class SubtitleStreamSummary(BaseModel):
    index: int
    codec_name: str | None = None
    language: str | None = None
    title: str | None = None
    is_chinese_likely: bool | None = None


class CaptionStreamsSummary(BaseModel):
    video: list[VideoStreamSummary] = Field(default_factory=list)
    audio: list[AudioStreamSummary] = Field(default_factory=list)
    subtitle: list[SubtitleStreamSummary] = Field(default_factory=list)


class SoftSubtitleInfo(BaseModel):
    count: int
    streams: list[SubtitleStreamSummary] = Field(default_factory=list)


class DetectedTextSample(BaseModel):
    timestamp_seconds: float
    text: str
    confidence: float
    bbox_area_ratio: float | None = None
    region: Literal["bottom", "middle", "top", "full"]


class VisualCaptionDetection(BaseModel):
    enabled: bool
    sampled_frames: int
    frames_with_text: int
    detected_text_samples: list[DetectedTextSample] = Field(default_factory=list)
    is_chinese_likely: bool | None = None


class AudioAnalysis(BaseModel):
    has_audio_stream: bool
    speech_detection_enabled: bool = False
    speech_likely: bool | None = None
    note: str | None = None


class CaptionRecommendation(BaseModel):
    next_step: str
    reason: str


class CaptionAnalyzeResult(BaseModel):
    file: CaptionAnalyzeFileInfo
    caption_type: CaptionType
    confidence: float
    summary: str
    has_soft_subtitle: bool
    has_hardcoded_visual_text: bool
    has_audio: bool
    has_speech_likely: bool | None = None
    streams: CaptionStreamsSummary
    soft_subtitle: SoftSubtitleInfo
    visual_caption_detection: VisualCaptionDetection
    audio_analysis: AudioAnalysis
    recommendation: CaptionRecommendation
    errors: list[str] = Field(default_factory=list)


class AnalyzeStoredVideoRequest(BaseModel):
    videoName: str
