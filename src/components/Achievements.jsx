import { useState, useEffect } from 'react'
import { achievements } from '../data/achievements'
import useScrollPopIn from '../hooks/useScrollPopIn'

function Achievements() {
  const [activeCert, setActiveCert] = useState(null)
  const listRef = useScrollPopIn(achievements.map((item) => item.id))

  // Close lightbox on Escape key and prevent background scroll while open
  useEffect(() => {
    if (!activeCert) return undefined

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveCert(null)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeCert])

  return (
    <section id="achievements" className="section">
      <div className="section-heading">
        <p className="eyebrow">Recognition</p>
        <h2>Achievements / Certificates</h2>
      </div>

      <ul className="achievement-list" ref={listRef}>
        {achievements.map((item) => (
          <li key={item.id} className="achievement-card" data-pop-id={item.id}>
            <div className="achievement-info">
              <div className="achievement-meta">
                <span className="achievement-issuer">{item.issuer}</span>
                <span className="achievement-dot">·</span>
                <span className="achievement-date">{item.date || item.year}</span>
              </div>
              <h3 className="achievement-title">{item.title}</h3>
              {item.description && (
                <p className="achievement-desc">{item.description}</p>
              )}
            </div>

            <button
              type="button"
              className="btn btn-outline achievement-btn"
              onClick={() => setActiveCert(item)}
            >
              View certificate
            </button>
          </li>
        ))}
      </ul>

      {/* Lightbox Preview */}
      {activeCert && (
        <div
          className="certificate-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Certificate for ${activeCert.title}`}
          onClick={(e) => {
            // Closes when clicking outside the preview container
            if (e.target === e.currentTarget) {
              setActiveCert(null)
            }
          }}
        >
          <div
            className="lightbox-content"
            onClick={(e) => {
              // If click is within content container but outside the preview image box, close
              if (e.target === e.currentTarget) {
                setActiveCert(null)
              }
            }}
          >
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setActiveCert(null)}
              aria-label="Close certificate preview"
            >
              ✕
            </button>

            <div
              className="lightbox-preview-wrap"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={activeCert.image}
                alt={activeCert.title}
                className="lightbox-image"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const fallback = e.currentTarget.nextElementSibling
                  if (fallback) fallback.style.display = 'flex'
                }}
              />
              <div className="lightbox-fallback" style={{ display: 'none' }}>
                <span className="fallback-badge">Certificate Preview</span>
                <h4>{activeCert.title}</h4>
                <p>
                  {activeCert.issuer} · {activeCert.date || activeCert.year}
                </p>
                <code className="fallback-path">{activeCert.image}</code>
                <span className="fallback-note">
                  Image not found at this path. Add the file to the public folder to display.
                </span>
              </div>
            </div>

            <div className="lightbox-details" onClick={(e) => e.stopPropagation()}>
              <h4>{activeCert.title}</h4>
              <p>
                {activeCert.issuer} · {activeCert.date || activeCert.year}
              </p>
              {activeCert.description && (
                <span className="lightbox-desc">{activeCert.description}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default Achievements
