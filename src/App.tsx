import { StoreProvider } from './store'
import { Shell } from './components/shell/Shell'

function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

export default App
