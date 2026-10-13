import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { makeStyles } from '@material-ui/core/styles'

const useStyles = makeStyles({
  toggle: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    border: 0,
    padding: 16,
    cursor: 'pointer',
    color: 'inherit',
    background: 'transparent',
    font: 'inherit',
    '&:focus-visible': { outline: '2px solid #31c27c', outlineOffset: -3 },
  },
  panel: { position: 'absolute', inset: 0, textAlign: 'center' },
  viewport: {
    position: 'absolute',
    inset: '0 0 48px',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    touchAction: 'pan-y',
    scrollbarWidth: 'none',
    WebkitMaskImage:
      'linear-gradient(transparent, black 10%, black 88%, transparent)',
    maskImage:
      'linear-gradient(transparent, black 10%, black 88%, transparent)',
    '&::-webkit-scrollbar': { display: 'none' },
    '&:focus-visible': { outline: '2px solid #31c27c', outlineOffset: -3 },
  },
  spacer: { height: 'calc(50% - 24px)', minHeight: 24 },
  plainSpacer: { height: 24 },
  lyrics: {
    margin: 0,
    padding: '0 20px',
    listStyle: 'none',
    '& > li': {
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      fontSize: 'clamp(17px, 4.5vw, 22px)',
      lineHeight: 1.75,
      padding: '10px 0',
      opacity: 0.48,
      transition: 'opacity 200ms ease, color 200ms ease',
    },
    '& > li[aria-current="true"]': {
      opacity: 1,
      fontWeight: 600,
      color: 'var(--share-lyric-active, #157c4b)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      '& > li': { transition: 'none' },
    },
  },
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
  },
  action: {
    border: 0,
    borderRadius: 22,
    minHeight: 44,
    padding: '8px 16px',
    font: 'inherit',
    fontSize: 12,
    cursor: 'pointer',
    color: 'inherit',
    background: 'rgba(128, 128, 128, 0.09)',
    '&:focus-visible': { outline: '2px solid #31c27c' },
  },
  empty: {
    height: '100%',
    display: 'grid',
    placeContent: 'center',
    opacity: 0.6,
  },
})

// A damaged metadata field must not prevent the public player from opening.
const parseShareLyrics = (lyrics) => {
  try {
    const entries = JSON.parse(lyrics || '[]')
    if (!Array.isArray(entries)) return null
    const valid = entries.filter((entry) => Array.isArray(entry?.line))
    const selected =
      valid.find((entry) => !entry.kind || entry.kind === 'main') || valid[0]
    if (!selected) return null
    return {
      ...selected,
      line: selected.line.filter((line) => typeof line?.value === 'string'),
    }
  } catch {
    return null
  }
}

const ShareLyrics = ({ container, lyrics, currentTime }) => {
  const classes = useStyles()
  const [cover, setCover] = useState(null)
  const [visible, setVisible] = useState(false)
  const [following, setFollowing] = useState(true)
  const activeLine = useRef(null)
  const viewport = useRef(null)
  const parsed = useMemo(() => parseShareLyrics(lyrics), [lyrics])
  const lines = parsed?.line || []
  const time = currentTime * 1000 + (parsed?.offset || 0)
  const active = parsed?.synced
    ? lines.reduce(
        (index, line, i) =>
          Number.isFinite(line.start) && line.start <= time ? i : index,
        -1,
      )
    : -1

  useEffect(() => {
    const root = container()
    if (!root) return
    const findCover = () =>
      setCover(root.querySelector('.react-jinke-music-player-mobile-cover'))
    findCover()
    const observer = new MutationObserver(findCover)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [container])

  useEffect(() => {
    if (!cover) return
    cover.classList.toggle('share-lyrics-visible', visible)
    return () => {
      cover.classList.remove('share-lyrics-visible')
    }
  }, [cover, visible])

  useEffect(() => {
    setFollowing(true)
    if (viewport.current) viewport.current.scrollTop = 0
  }, [lyrics, visible])

  useEffect(() => {
    if (!visible || !following || !viewport.current || !activeLine.current)
      return
    const area = viewport.current
    const center = () => {
      const line = activeLine.current
      if (!line) return
      const top =
        area.scrollTop +
        line.getBoundingClientRect().top -
        area.getBoundingClientRect().top -
        area.clientHeight / 2 +
        line.clientHeight / 2
      const reduced = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches
      if (area.scrollTo)
        area.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })
      else area.scrollTop = top
    }
    center()
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(center)
    observer?.observe(area)
    return () => observer?.disconnect()
  }, [active, following, visible, lyrics])

  const pauseFollowing = () => {
    if (parsed?.synced) setFollowing(false)
  }
  if (!cover) return null
  return createPortal(
    visible ? (
      <div
        className={classes.panel}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div
          ref={viewport}
          className={classes.viewport}
          role="region"
          aria-label="歌词"
          tabIndex={0}
          onWheel={pauseFollowing}
          onTouchMove={pauseFollowing}
          onKeyDown={(event) => {
            if (
              [
                'ArrowUp',
                'ArrowDown',
                'PageUp',
                'PageDown',
                'Home',
                'End',
              ].includes(event.key)
            )
              pauseFollowing()
          }}
        >
          {lines.length ? (
            <>
              <div
                className={
                  parsed?.synced ? classes.spacer : classes.plainSpacer
                }
                aria-hidden="true"
              />
              <ol className={classes.lyrics}>
                {lines.map((line, i) => (
                  <li
                    key={i}
                    ref={i === active ? activeLine : null}
                    aria-current={i === active ? 'true' : undefined}
                  >
                    {line.value || '\u00a0'}
                  </li>
                ))}
              </ol>
              <div
                className={
                  parsed?.synced ? classes.spacer : classes.plainSpacer
                }
                aria-hidden="true"
              />
            </>
          ) : (
            <div className={classes.empty}>暂无歌词</div>
          )}
        </div>
        <div className={classes.actions}>
          <button
            type="button"
            className={classes.action}
            aria-label="显示专辑封面"
            onClick={() => setVisible(false)}
          >
            返回封面
          </button>
          {!following && parsed?.synced && (
            <button
              type="button"
              className={classes.action}
              onClick={() => setFollowing(true)}
            >
              回到当前歌词
            </button>
          )}
        </div>
      </div>
    ) : (
      <button
        type="button"
        className={classes.toggle}
        aria-label="显示歌词"
        title="点击显示歌词"
        onClick={(event) => {
          event.stopPropagation()
          setVisible(true)
        }}
        onKeyDown={(event) => event.stopPropagation()}
      />
    ),
    cover,
  )
}

ShareLyrics.propTypes = {
  container: PropTypes.func.isRequired,
  lyrics: PropTypes.string,
  currentTime: PropTypes.number.isRequired,
}

export default ShareLyrics
