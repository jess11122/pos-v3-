import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import StaffPicker from '../../components/ui/StaffPicker'
import FloorMap from './FloorMap'
import PreOrderChecklist from './PreOrderChecklist'
import MenuStep from './MenuStep'

export default function WaiterPage() {
  const { selectedStaff, saveStaff } = useApp()
  const [step, setStep] = useState('floor') // floor | checklist | menu
  const [selectedTable, setSelectedTable] = useState(null)
  const [checklist, setChecklist] = useState(null)
  const [mode, setMode] = useState('new') // new | add

  if (!selectedStaff) return <StaffPicker onSelect={saveStaff} />

  const handleTableSelect = (table, tableMode) => {
    setSelectedTable(table)
    setMode(tableMode || 'new')
    setStep('checklist')
  }

  const handleChecklistDone = (data) => {
    setChecklist(data)
    setStep('menu')
  }

  const handleOrderDone = () => {
    setStep('floor')
    setSelectedTable(null)
    setChecklist(null)
  }

  const handleBack = () => {
    if (step === 'menu') setStep('checklist')
    else if (step === 'checklist') { setStep('floor'); setSelectedTable(null) }
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      {step === 'floor' && (
        <FloorMap staff={selectedStaff} onTableSelect={handleTableSelect} onLogout={() => saveStaff(null)} />
      )}
      {step === 'checklist' && (
        <PreOrderChecklist
          table={selectedTable}
          onConfirm={handleChecklistDone}
          onBack={handleBack}
        />
      )}
      {step === 'menu' && (
        <MenuStep
          table={selectedTable}
          checklist={checklist}
          staff={selectedStaff}
          mode={mode}
          onDone={handleOrderDone}
          onBack={handleBack}
        />
      )}
    </div>
  )
}
