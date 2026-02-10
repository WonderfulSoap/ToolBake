import type { Tool } from "~/entity/tool";
import { OfficialToolBase64FileEncoderDecoder } from "./official/base64-file-encoder-decoder/def";
import { OfficialToolBase64TextEncoderDecoder } from "./official/base64-text-encoder-decoder/def";
import { OfficialToolUrlEncoderDecoder } from "./official/url-encoder-decoder/def";
import { OfficialToolUrlParserBuilder } from "./official/url-parser-builder/def";
import { OfficialToolHtmlEscapeUnescape } from "./official/html-escape-unescape/def";
import { OfficialToolColorPickerConverter } from "./official/color-picker-converter/def";
import { OfficialToolDateTimeTimestampConverter } from "./official/datetime-timstamp-converter/def";
import { OfficialToolFileBinaryEncoderDecoder } from "./official/file-binary-converter/def";
import { OfficialToolImageFormatConverter } from "./official/image-format-converter/def";
import { OfficialToolArchiveFileList } from "./official/archive-file-list/def";
import { OfficialToolArchiveFormatConverter } from "./official/archive-format-converter/def";
import { OfficialToolTextBinaryEncoderDecoder } from "./official/text-binary-converter/def";
import { OfficialToolVideoMetaInfo } from "./official/video-meta-info/def";
import { OfficialToolVideoTrackDumperDemuxer } from "./official/video-track-dumper-demuxer/def";
import { OfficialToolVideoTrackMerger } from "./official/video-track-merger/def";
import { OfficialToolVideoFormatConverter } from "./official/video-format-converter/def";
import { OfficialToolVideoFormatConverterAdvanced } from "./official/video-format-converter-advanced/def";
import { OfficialToolAudioMetaArtworkEditor } from "./official/audio-meta-artwork-editor/def";
import { OfficialToolAudioToWavConverter } from "./official/audio-to-wav-converter/def";
import { OfficialToolAudioToFlacConverter } from "./official/audio-to-flac-converter/def";
import { OfficialToolAudioToMp3Converter } from "./official/audio-to-mp3-converter/def";
import { OfficialToolAudioToAacConverter } from "./official/audio-to-aac-converter/def";
import { OfficialToolAudioToOggConverter } from "./official/audio-to-ogg-converter/def";
import { OfficialToolAudioToWmaConverter } from "./official/audio-to-wma-converter/def";
import { OfficialToolAudioToAlacConverter } from "./official/audio-to-alac-converter/def";
import { OfficialToolAudioToTtaConverter } from "./official/audio-to-tta-converter/def";
import { OfficialToolAudioToPcmConverter } from "./official/audio-to-pcm-converter/def";
import { OfficialToolAudioConcatenator } from "./official/audio-concatenator/def";
import { OfficialToolAudioFilterLab } from "./official/audio-filter-lab/def";
import { OfficialToolFfmpegCodecList } from "./official/ffmpeg-codec-list/def";
import { OfficialToolFfmpegFilterList } from "./official/ffmpeg-filter-list/def";
import {  OfficialToolUnicodeTextEncoderDecoder } from "./official/unicode-text-converter/def";
import { OfficialToolIntegerBaseConverter } from "./official/integer-base-converter/def";
import { OfficialToolUnitConverter } from "./official/unit-converter/def";
import { OfficialToolRomanNumeralConverter } from "./official/roman-numeral-converter/def";
import { OfficialToolTextCaseConverter } from "./official/text-case-converter/def";
import { OfficialToolJsonXmlYamlTomlConverter } from "./official/json-xml-yaml-toml-converter/def";
import { OfficialToolJsonPrettifyMinify } from "./official/json-prettify-minify/def";
import { OfficialToolXmlPrettifyMinify } from "./official/xml-prettify-minify/def";
import { OfficialToolSqlPrettify } from "./official/sql-prettify/def";
import { OfficialToolCsvToJsonConverter } from "./official/csv-to-json-converter/def";
import { OfficialToolJsonToCsvConverter } from "./official/json-to-csv-converter/def";
import { OfficialToolJsonDataTemplateRenderer } from "./official/handlebars-template-renderer/def";
import { OfficialToolJsonPathTester } from "./official/json-path-tester/def";
import { OfficialToolJsonataTester } from "./official/jsonata-tester/def";
import { OfficialToolJsonMediaDataVisualizer } from "./official/json-datauri-viewer/def";
import { OfficialToolTimeCalculator } from "./official/time-calculator/def";
import { OfficialToolHashString } from "./official/hash-string/def";
import { OfficialToolHashFile } from "./official/hash-file/def";
import { OfficialToolRandomStringGenerator } from "./official/random-string-generator/def";
import { OfficialToolTextLinesTransformer } from "./official/text-lines-transformer/def";
import { OfficialToolEscapedTextEncoderDecoder } from "./official/escaped-text-encoder-decoder/def";
import { OfficialToolMarkdownRenderer } from "./official/markdown-renderer/def";
import { OfficialToolLabelInteractionShowcase } from "./official/label-interaction-showcase/def";
import { OfficialToolLabelDynamicDemo } from "./official/label-dynamic-demo/def";
import { OfficialToolRawHtmlScriptShowcase } from "./official/raw-html-script-showcase/def";
import { OfficialToolBlockrainTetris } from "./official/blockrain-tetris/def";
import { OfficialToolULIDGenerator } from "./official/ulid-generator/def";
import { OfficialToolUUIDGenerator } from "./official/uuid-generator/def";
import { OfficialToolDeviceScreenInfo } from "./official/device-screen-info/def";
import { OfficialToolClipboardPreviewDownloader } from "./official/clipboard-preview-downloader/def";
import { OfficialToolHttpBasicAuthGenerator } from "./official/http-basic-auth-generator/def";
import { OfficialToolQrcodeGenerator } from "./official/qrcode-generator/def";
import { OfficialToolRandomPortGenerator } from "./official/random-port-generator/def";
import { OfficialToolIpv4SubnetCidrCalculator } from "./official/ipv4-cidr-subnet-toolkit/def";
import { OfficialToolIpv6SubnetToolkit } from "./official/ipv6-subnet-toolkit/def";
import { OfficialToolTextEncodingFixer } from "./official/text-encoding-converter/def";
import { OfficialToolIpInfoLookup } from "./official/ip-intel-lookup/def";
import { OfficialToolEscapedJsonItemDecoder } from "./official/escaped-json-item-encoder/def";
import { OfficialToolExchangeRateConverter } from "./official/exchange-rate-converter/def";
import { OfficialToolImageCropRotate } from "./official/image-crop-rotate/def";
import { OfficialToolImageFilterLab } from "./official/image-color-adjust/def";
import { OfficialToolImagemagickImageDiff } from "./official/imagemagick-image-diff/def";
import { OfficialToolImagemagickFeatureList } from "./official/imagemagick-feature-list/def";
import { OfficialToolAudioCutStudio } from "./official/audio-cut-studio/def";
import { OfficialToolJpegTargetSizeCompressor } from "./official/jpeg-target-size-compressor/def";
import { OfficialToolJsonStringEscaper } from "./official/json-string-escaper/def";
import { OfficialToolSvgConverter } from "./official/svg-converter/def";
import { OfficialToolImageToIcoMaker } from "./official/image-to-ico-maker/def";
import { OfficialToolIcoExtractor } from "./official/ico-extractor/def";
import { OfficialToolImageBatchResizer } from "./official/image-batch-resizer/def";

export const officialTools: Tool[] = [
  // Life
  OfficialToolUnitConverter,
  OfficialToolRomanNumeralConverter,
  OfficialToolExchangeRateConverter,
  OfficialToolTimeCalculator,  
  
  // Audio Metadata
  OfficialToolAudioMetaArtworkEditor,

  // Audio Format Converters
  OfficialToolAudioToWavConverter,
  OfficialToolAudioToFlacConverter,
  OfficialToolAudioToMp3Converter,
  OfficialToolAudioToAacConverter,
  OfficialToolAudioToOggConverter,
  OfficialToolAudioToWmaConverter,
  OfficialToolAudioToAlacConverter,
  OfficialToolAudioToTtaConverter,
  OfficialToolAudioToPcmConverter,

  // Audio Merger/Spliter
  OfficialToolAudioConcatenator,
  OfficialToolAudioCutStudio,

  // Audio Mixer
  OfficialToolAudioFilterLab,

  // Video Metadata
  OfficialToolVideoMetaInfo,

  // Video Format Converters
  OfficialToolVideoFormatConverter,
  OfficialToolVideoFormatConverterAdvanced,
  
  // Video Demuxer/Muxer
  OfficialToolVideoTrackDumperDemuxer,
  OfficialToolVideoTrackMerger,

  // Video FFmpeg Wasm
  OfficialToolFfmpegCodecList,
  OfficialToolFfmpegFilterList,
  
  // Image Processors
  // OfficialToolImageBatchProcessor,
  OfficialToolImageCropRotate,
  OfficialToolImageBatchResizer,
  
  // Image Format Converters
  OfficialToolImageFormatConverter,
  OfficialToolSvgConverter,
  OfficialToolImageToIcoMaker,
  OfficialToolIcoExtractor,
  
  // Image Compressors
  OfficialToolJpegTargetSizeCompressor,
  
  // Image DIFF
  OfficialToolImagemagickImageDiff,

  // Image Color Adjustment
  OfficialToolImageFilterLab,

  // Image Magick.wasm Features
  OfficialToolImagemagickFeatureList,

  // Archive Tools
  OfficialToolArchiveFileList,
  OfficialToolArchiveFormatConverter,

  // Encoder/Decoder
  OfficialToolHashString,
  OfficialToolHashFile,
  OfficialToolBase64TextEncoderDecoder,
  OfficialToolBase64FileEncoderDecoder,
  OfficialToolTextEncodingFixer,
  OfficialToolUrlEncoderDecoder,
  OfficialToolHtmlEscapeUnescape,
  OfficialToolTextBinaryEncoderDecoder,
  OfficialToolFileBinaryEncoderDecoder,
  OfficialToolUnicodeTextEncoderDecoder,
  OfficialToolQrcodeGenerator,
  OfficialToolEscapedTextEncoderDecoder,
  OfficialToolEscapedJsonItemDecoder,
  OfficialToolJsonStringEscaper,


  // Converter
  OfficialToolIntegerBaseConverter,
  OfficialToolTextCaseConverter,
  OfficialToolJsonXmlYamlTomlConverter,
  OfficialToolJsonPrettifyMinify,
  OfficialToolXmlPrettifyMinify,
  OfficialToolSqlPrettify,
  OfficialToolCsvToJsonConverter,
  OfficialToolJsonToCsvConverter,
  OfficialToolTextLinesTransformer,
  
  // Data Process
  OfficialToolJsonPathTester,
  OfficialToolJsonataTester,
  OfficialToolJsonMediaDataVisualizer,

  // Preview
  OfficialToolClipboardPreviewDownloader,
  OfficialToolJsonDataTemplateRenderer,
  
  // Time Tools
  OfficialToolDateTimeTimestampConverter,
  
  // Generator Tools
  OfficialToolUUIDGenerator,
  OfficialToolULIDGenerator,
  OfficialToolRandomStringGenerator,
  
  // Markdown
  OfficialToolMarkdownRenderer,
  
  // Color Tools
  OfficialToolColorPickerConverter,
  
  // Device Tools
  OfficialToolDeviceScreenInfo,
  

  
  // API Tools
  OfficialToolHttpBasicAuthGenerator,
  OfficialToolUrlParserBuilder,

  // Network Tools
  OfficialToolIpv4SubnetCidrCalculator,
  OfficialToolIpv6SubnetToolkit,
  OfficialToolRandomPortGenerator,
  OfficialToolIpInfoLookup,
  
  // Game
  OfficialToolBlockrainTetris,

  // Demo/Showcase
  OfficialToolLabelInteractionShowcase,
  OfficialToolLabelDynamicDemo,
  OfficialToolRawHtmlScriptShowcase,
];
