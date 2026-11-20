import { contact } from '../data/contact'

function Navbar() {
  return (
    <header className="navbar">
      <a className="nav-brand" href="#hero">
        Mohd Shoyab
      </a>
      <nav className="nav-links" aria-label="Primary">
        <a href="#projects">Projects</a>
        <a href="#achievements">Achievements</a>
        <a href={contact.linkedin} target="_blank" rel="noreferrer">
          LinkedIn
        </a>
      </nav>
    </header>
  )
}

export default Navbar
