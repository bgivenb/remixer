from __future__ import annotations

from types import SimpleNamespace

from remixer_worker.separation import _align_session_chunk_size


def test_chunk_size_is_aligned_to_model_stft_hop() -> None:
    config = SimpleNamespace(
        model=SimpleNamespace(stft_hop_length=512),
        inference=SimpleNamespace(num_overlap=2),
        audio=SimpleNamespace(chunk_size=881_559),
    )
    session = SimpleNamespace(_config=config)

    assert _align_session_chunk_size(session) == (881_559, 881_152)
    assert config.audio.chunk_size == 881_152


def test_aligned_chunk_is_not_changed() -> None:
    config = SimpleNamespace(
        model=SimpleNamespace(stft_hop_length=512),
        inference=SimpleNamespace(chunk_size=588_800, num_overlap=2),
    )
    session = SimpleNamespace(_config=config)

    assert _align_session_chunk_size(session) == (588_800, 588_800)
