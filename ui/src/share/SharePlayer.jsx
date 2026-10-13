import ReactJkMusicPlayer from 'navidrome-music-player'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import config, { shareInfo } from '../config'
import { shareCoverUrl, shareDownloadUrl, shareStreamUrl } from '../utils'

import { makeStyles } from '@material-ui/core/styles'
import ShareLyrics from './ShareLyrics'

// How long the download button stays inert after a click. The browser needs a
// moment to show its own download UI; until then the page looks unresponsive.
export const DOWNLOAD_FEEDBACK_MS = 5000

const useStyle = makeStyles({
  player: {
    '--share-lyric-active': '#70e3ac',
    '&.light-theme': { '--share-lyric-active': '#157c4b' },
    '& .react-jinke-music-player-mobile-cover': {
      position: 'relative',
    },
    '& .share-lyrics-visible img': { visibility: 'hidden' },
    '& .react-jinke-music-player-mobile-cover.share-lyrics-visible': {
      borderRadius: 0,
      border: '0 !important',
      boxShadow: 'none !important',
      width: '100% !important',
      height: 'auto !important',
      flex: '1 1 0',
      minHeight: 0,
      margin: '8px auto 12px',
      '& img': { display: 'none' },
    },
    '& .react-jinke-music-player-mobile.share-lyrics-mode': {
      boxSizing: 'border-box',
      padding: '16px 20px max(16px, env(safe-area-inset-bottom))',
      '& > .group': { flex: '0 0 auto', maxWidth: '100%' },
      '& .react-jinke-music-player-mobile-header-title': {
        fontSize: 18,
        whiteSpace: 'normal',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        lineHeight: 1.5,
      },
      '& .react-jinke-music-player-mobile-singer': { padding: '8px 0 12px' },
      '& .react-jinke-music-player-mobile-switch': { display: 'none' },
      '& .react-jinke-music-player-mobile-progress': { minHeight: 36 },
      '& .react-jinke-music-player-mobile-toggle': { padding: '16px 0' },
      '& .react-jinke-music-player-mobile-operation': { padding: '12px 0' },
    },
    '& .group .next-audio': {
      pointerEvents: (props) => props.single && 'none',
      opacity: (props) => props.single && 0.65,
    },
    '& .group.audio-download': {
      pointerEvents: (props) => props.downloading && 'none',
      opacity: (props) => props.downloading && 0.65,
    },
    '@media (min-width: 768px)': {
      '& .react-jinke-music-player-mobile > div': {
        width: 768,
        margin: 'auto',
      },
      '& .react-jinke-music-player-mobile-cover:not(.share-lyrics-visible)': {
        width: 'auto !important',
      },
    },
  },
})

const SharePlayer = () => {
  const [downloading, setDownloading] = useState(false)
  const timer = useRef(null)
  const [container, setContainer] = useState(null)
  const getContainer = useCallback(() => container, [container])
  const [playback, setPlayback] = useState({
    trackId: shareInfo?.tracks[0]?.id,
    currentTime: 0,
  })
  const updatePlayback = useCallback((info) => {
    setPlayback({ trackId: info.trackId, currentTime: info.currentTime || 0 })
  }, [])
  const classes = useStyle({
    single: shareInfo?.tracks.length === 1,
    downloading,
  })

  useEffect(() => () => clearTimeout(timer.current), [])

  const list = useMemo(
    () =>
      shareInfo?.tracks.map((s) => {
        return {
          trackId: s.id,
          name: s.title,
          musicSrc: shareStreamUrl(s.id),
          cover: shareCoverUrl(s.id, true),
          singer: s.artist,
          duration: s.duration,
        }
      }),
    [],
  )
  // An anchor, not a navigation: the service worker's NavigationRoute would
  // intercept the streamed archive and fail it.
  const customDownloader = useCallback(() => {
    const link = document.createElement('a')
    link.href = shareDownloadUrl(shareInfo?.id)
    link.download = ''
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setDownloading(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(
      () => setDownloading(false),
      DOWNLOAD_FEEDBACK_MS,
    )
  }, [])
  const options = {
    audioLists: list,
    mode: 'full',
    toggleMode: false,
    mobileMediaQuery: '',
    showDownload: shareInfo?.downloadable && config.enableDownloads,
    showReload: false,
    showMediaSession: true,
    theme: 'auto',
    showThemeSwitch: false,
    restartCurrentOnPrev: true,
    remove: false,
    spaceBar: true,
    volumeFade: { fadeIn: 200, fadeOut: 200 },
    sortableOptions: { delay: 200, delayOnTouchOnly: true },
  }
  return (
    <div ref={setContainer}>
      {container && (
        <>
          <ReactJkMusicPlayer
            {...options}
            className={classes.player}
            customDownloader={customDownloader}
            getContainer={getContainer}
            onAudioProgress={updatePlayback}
            onAudioPlay={updatePlayback}
            onAudioSeeked={updatePlayback}
            onAudioPlayTrackChange={(playId, tracks) => {
              const track = tracks.find(
                (item) => item.__PLAYER_KEY__ === playId,
              )
              setPlayback({ trackId: track?.trackId, currentTime: 0 })
            }}
          />
          <ShareLyrics
            container={getContainer}
            lyrics={
              shareInfo?.tracks.find((track) => track.id === playback.trackId)
                ?.lyrics
            }
            currentTime={playback.currentTime}
          />
        </>
      )}
    </div>
  )
}

export default SharePlayer
