import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Projects from './components/Projects'
import Achievements from './components/Achievements'
import './App.css'

function App() {
  return (
    <div className="page">
      <Navbar />
      <main>
        <Hero />
        <Projects />
        <Achievements />
      </main>
    </div>
  )
}

export default App
