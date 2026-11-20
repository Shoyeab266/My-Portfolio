import { useState } from 'react'
import { projects } from '../data/projects'
import useScrollPopIn from '../hooks/useScrollPopIn'

const VISIBLE_COUNT = 3

function ProjectCard({ project }) {
  return (
    <article className="project-card" data-pop-id={project.id}>
      <h3>{project.title}</h3>
      <p>{project.description}</p>
      <ul className="tags">
        {project.tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      <div className="project-links">
        {project.liveUrl ? (
          <a href={project.liveUrl} target="_blank" rel="noreferrer">
            Live
          </a>
        ) : (
          <span>Live soon</span>
        )}
        {project.repoUrl ? (
          <a href={project.repoUrl} target="_blank" rel="noreferrer">
            Code
          </a>
        ) : (
          <span>Code soon</span>
        )}
      </div>
    </article>
  )
}

function Projects() {
  const [expanded, setExpanded] = useState(false)
  const visibleProjects = expanded ? projects : projects.slice(0, VISIBLE_COUNT)
  const hasMore = projects.length > VISIBLE_COUNT
  const gridRef = useScrollPopIn(visibleProjects.map((project) => project.id))

  return (
    <section id="projects" className="section">
      <div className="section-heading">
        <p className="eyebrow">Selected work</p>
        <h2>Projects</h2>
      </div>
      <div className="project-grid" ref={gridRef}>
        {visibleProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
      {hasMore ? (
        <button
          type="button"
          className="btn btn-outline show-more"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </section>
  )
}

export default Projects
