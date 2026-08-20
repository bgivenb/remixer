import { useState } from 'react'
import { Download, LoaderCircle, Play, Search } from 'lucide-react'
import type { YouTubeVideo } from '../types'
import { formatDuration } from '../lib'
import { FEATURED_VIDEO } from '../featured'

const YOUTUBE_CLIENT_ORIGIN = 'https://www.givenpeace.com'

interface YouTubeBrowserProps {
  disabled: boolean
  onUseVideo: (video: YouTubeVideo) => void
}

export function YouTubeBrowser({ disabled, onUseVideo }: YouTubeBrowserProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<YouTubeVideo>(FEATURED_VIDEO)
  const [results, setResults] = useState<YouTubeVideo[]>([FEATURED_VIDEO])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    setError('')
    try {
      const videos = await window.remixer.runWorker<YouTubeVideo[]>({ command: 'search_youtube', query: query.trim(), limit: 8 })
      setResults(videos)
      if (videos[0]) setSelected(videos[0])
      if (!videos.length) setError('No public videos matched that search.')
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : String(searchError))
    } finally {
      setSearching(false)
    }
  }

  return (
    <section className="youtube-browser panel">
      <div className="youtube-browser-heading">
        <div><span className="youtube-mark"><Play size={17} fill="currentColor" /></span><div><p className="eyebrow">YouTube discovery</p><strong>Find a track without leaving Remixer</strong></div></div>
        <div className="youtube-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void search() }}
            placeholder="Search artists, songs, or videos…"
            aria-label="Search YouTube"
          />
          <button className="small-button" onClick={() => void search()} disabled={searching || !query.trim()}>
            {searching ? <LoaderCircle className="spin" size={14} /> : <Search size={14} />} Search
          </button>
        </div>
      </div>
      {error ? <div className="youtube-error">{error}</div> : null}
      <div className="youtube-browser-body">
        <div className="youtube-player-column">
          <div className="youtube-player">
            <iframe
              key={selected.id}
              src={`https://www.youtube-nocookie.com/embed/${selected.id}?rel=0&origin=${encodeURIComponent(YOUTUBE_CLIENT_ORIGIN)}&widget_referrer=${encodeURIComponent(`${YOUTUBE_CLIENT_ORIGIN}/`)}`}
              title={selected.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          <div className="youtube-now-playing">
            <div>
              <span>{selected.id === FEATURED_VIDEO.id ? 'Featured example · Given Peace' : selected.channel || 'YouTube'}</span>
              <strong>{selected.title}</strong>
            </div>
            <button className="primary-button" onClick={() => onUseVideo(selected)} disabled={disabled}>
              <Download size={15} /> {selected.id === FEATURED_VIDEO.id ? 'Remix this song' : 'Use in Remixer'}
            </button>
          </div>
        </div>
        <div className="youtube-results" aria-label="YouTube search results">
          {results.map((video) => (
            <button key={video.id} className={`youtube-result ${selected.id === video.id ? 'active' : ''}`} onClick={() => setSelected(video)}>
              <img src={video.thumbnail} alt="" loading="lazy" />
              <span><strong>{video.title}</strong><small>{video.channel || 'YouTube'}{video.duration ? ` · ${formatDuration(video.duration)}` : ''}</small></span>
            </button>
          ))}
        </div>
      </div>
      <p className="youtube-disclaimer">Only download audio you own or are authorized to remix. Playback is provided by YouTube’s embedded player.</p>
    </section>
  )
}
