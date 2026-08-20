import type { Track, YouTubeVideo } from './types'

export const FEATURED_VIDEO: YouTubeVideo = {
  id: 'JR2zel8dJts',
  title: 'Given Peace - Down So Bad (Official Music Video)',
  channel: 'Given Peace',
  duration: 182,
  thumbnail: 'https://i.ytimg.com/vi/JR2zel8dJts/maxresdefault.jpg',
  url: 'https://www.youtube.com/watch?v=JR2zel8dJts',
}

export function isFeaturedTrack(track: Track): boolean {
  if (track.id === FEATURED_VIDEO.id) return true
  if (!track.source_url) return false
  try {
    const source = new URL(track.source_url)
    return source.searchParams.get('v') === FEATURED_VIDEO.id || source.pathname.split('/').filter(Boolean).at(-1) === FEATURED_VIDEO.id
  } catch {
    return track.source_url.includes(FEATURED_VIDEO.id)
  }
}

export function pinFeaturedTrack(tracks: Track[]): Track[] {
  return [...tracks].sort((left, right) => Number(isFeaturedTrack(right)) - Number(isFeaturedTrack(left)))
}
