import Input from "@razzia/web/components/Input"
import { useEffect, useState } from "react"

interface Props {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (_value: number) => void
}

const ConfigNumberInput = ({ label, value, min, max, onChange }: Props) => {
  const [input, setInput] = useState(String(value))

  useEffect(() => {
    setInput(String(value))
  }, [value])

  const handleChange = (raw: string) => {
    setInput(raw)

    const num = Number(raw)

    if (raw === "" || isNaN(num)) {
      return
    }

    const clamped = Math.min(max ?? num, Math.max(min ?? num, num))
    onChange(clamped)
  }

  return (
    <Input
      variant="sm"
      type="number"
      aria-label={label}
      min={min}
      max={max}
      value={input}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => setInput(String(value))}
      className="min-h-11 w-full text-base"
    />
  )
}

export default ConfigNumberInput
