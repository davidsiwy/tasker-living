import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'

const Ctx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([])
  const push = useCallback((msg: string) => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s, { id, msg }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 2600)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {items.map((t) => (
          <div className="toast" key={t.id}><Icon name="check" small />{t.msg}</div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
