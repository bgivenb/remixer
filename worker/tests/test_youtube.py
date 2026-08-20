from __future__ import annotations

import sys
from types import SimpleNamespace

from remixer_worker.youtube import search_youtube


def test_search_youtube_returns_flat_video_results(monkeypatch) -> None:
    class FakeYoutubeDL:
        def __init__(self, _options) -> None:
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args) -> None:
            pass

        def extract_info(self, query, download=False):
            assert query == "ytsearch3:Given Peace"
            assert download is False
            return {
                "entries": [
                    {
                        "id": "JR2zel8dJts",
                        "title": "Given Peace - Down So Bad (Official Music Video)",
                        "channel": "Given Peace",
                        "duration": 182,
                    }
                ]
            }

    monkeypatch.setitem(sys.modules, "yt_dlp", SimpleNamespace(YoutubeDL=FakeYoutubeDL))
    monkeypatch.setitem(sys.modules, "yt_dlp.utils", SimpleNamespace(DownloadError=RuntimeError))

    assert search_youtube(" Given Peace ", 3) == [
        {
            "id": "JR2zel8dJts",
            "title": "Given Peace - Down So Bad (Official Music Video)",
            "channel": "Given Peace",
            "duration": 182.0,
            "thumbnail": "https://i.ytimg.com/vi/JR2zel8dJts/hqdefault.jpg",
            "url": "https://www.youtube.com/watch?v=JR2zel8dJts",
        }
    ]
