import { useState, useRef } from 'react'

export default function Tooltip({ text, children, side = 'top' }:{ text:string, children:React.ReactNode, side?: 'top'|'bottom'|'left'|'right' }){
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      className="relative inline-flex max-w-full"
      onMouseEnter={()=>setOpen(true)}
      onMouseLeave={()=>setOpen(false)}
      ref={ref}
    >
      {children}
      {open && text && (
        <div className={`pointer-events-none absolute z-50 whitespace-pre-line text-xs text-white px-2 py-1 rounded shadow-lg bg-slate-900/90 backdrop-blur ${
          side==='top' ? 'left-1/2 -translate-x-1/2 bottom-[calc(100%+6px)]' :
          side==='bottom' ? 'left-1/2 -translate-x-1/2 top-[calc(100%+6px)]' :
          side==='left' ? 'right-[calc(100%+6px)] top-1/2 -translate-y-1/2' :
          'left-[calc(100%+6px)] top-1/2 -translate-y-1/2'
        }`}>
          {text}
        </div>
      )}
    </div>
  )
}
