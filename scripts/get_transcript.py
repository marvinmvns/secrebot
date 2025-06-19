#!/usr/bin/env python3
import sys
import json
import re
from youtube_transcript_api import YouTubeTranscriptApi


def extract_video_id(url_or_id: str) -> str:
    match = re.search(r'(?:v=|/)([0-9A-Za-z_-]{11})', url_or_id)
    if match:
        return match.group(1)
    return url_or_id


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: get_transcript.py <url_or_id>"}))
        sys.exit(1)

    vid = extract_video_id(sys.argv[1])
    try:
        transcript = YouTubeTranscriptApi.get_transcript(vid, languages=['pt', 'en'])
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)

    text = " ".join(segment['text'] for segment in transcript)
    print(json.dumps({"text": text}))


if __name__ == "__main__":
    main()
