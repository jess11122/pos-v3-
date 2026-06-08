import { useState } from 'react'
import { ALLERGENS } from '../../lib/constants'
import Modal from '../../components/ui/Modal'

export default function PreOrderChecklist({ table, onConfirm, onBack }) {
  const [idChecked, setIdChecked] = useState(false)
  const [allergyChecked, setAllergyChecked] = useState(false)
  const [hasAllergens, setHasAllergens] = useState(null) // null | true | false
  const [selectedAllergens, setSelectedAllergens] = useState([])
  const [showAgeCalc, setShowAgeCalc] = useState(false)
  const [dob, setDob] = useState('')
  const [ageResult, setAgeResult] = useState(null)

  const canContinue = idChecked && allergyChecked && (hasAllergens === false || (hasAllergens === true && selectedAllergens.length > 0))

  const toggleAllergen = (a) => {
    setSelectedAllergens(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    )
  }

  const calcAge = () => {
    if (!dob) return
    const birth = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    setAgeResult(age)
  }

  const handleConfirm = () => {
    onConfirm({
      idChecked,
      allergyChecked,
      allergens: hasAllergens ? selectedAllergens : [],
    })
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      <header className="bg-zinc-900 px-5 py-4 flex items-center gap-4 border-b border-zinc-800">
        <button onClick={onBack} className="text-zinc-400 hover:text-white font-barlow text-2xl leading-none touch-btn w-10 h-10 flex items-center justify-center">
          ←
        </button>
        <div>
          <h1 className="font-oswald text-2xl text-white">Pre-Order Checks</h1>
          <p className="font-barlow text-zinc-400">Table {table.number}</p>
        </div>
      </header>

      <div className="flex-1 p-5 max-w-lg mx-auto w-full space-y-4">
        {/* ID Check */}
        <CheckCard
          title="ID Checked"
          desc="Confirm you have checked ID for anyone who looks under 25"
          icon="🪪"
          checked={idChecked}
          onToggle={() => setIdChecked(!idChecked)}
          required
        />

        {/* Allergy Check */}
        <CheckCard
          title="Allergies Asked"
          desc="Have you asked the table about any food or drink allergies?"
          icon="⚠️"
          checked={allergyChecked}
          onToggle={() => setAllergyChecked(!allergyChecked)}
          required
        />

        {/* Allergen selection */}
        {allergyChecked && (
          <div className="bg-zinc-800 rounded-2xl p-5 space-y-4">
            <p className="font-barlow text-white text-lg font-semibold">Does anyone at the table have allergens?</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setHasAllergens(false); setSelectedAllergens([]) }}
                className={`flex-1 py-3 rounded-xl font-oswald text-lg transition-colors ${hasAllergens === false ? 'bg-green-600 text-white' : 'bg-zinc-700 text-zinc-300'}`}
              >
                No Allergens
              </button>
              <button
                onClick={() => setHasAllergens(true)}
                className={`flex-1 py-3 rounded-xl font-oswald text-lg transition-colors ${hasAllergens === true ? 'bg-red-600 text-white' : 'bg-zinc-700 text-zinc-300'}`}
              >
                Yes — Select
              </button>
            </div>

            {hasAllergens === true && (
              <div>
                <p className="font-barlow text-zinc-400 text-sm mb-3">Select all that apply:</p>
                <div className="grid grid-cols-2 gap-2">
                  {ALLERGENS.map(a => (
                    <button
                      key={a}
                      onClick={() => toggleAllergen(a)}
                      className={`py-3 px-3 rounded-xl font-barlow text-base transition-colors text-left ${
                        selectedAllergens.includes(a)
                          ? 'bg-red-600 text-white'
                          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                      }`}
                    >
                      {selectedAllergens.includes(a) ? '✓ ' : ''}{a}
                    </button>
                  ))}
                </div>
                {selectedAllergens.length > 0 && (
                  <p className="font-barlow text-red-400 text-sm mt-3">
                    ⚠ {selectedAllergens.length} allergen{selectedAllergens.length > 1 ? 's' : ''} noted — menu will be filtered
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!canContinue}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-oswald text-xl py-5 rounded-2xl transition-colors touch-btn"
        >
          Continue to Menu →
        </button>
      </div>

      {/* Age calculator floating button */}
      <button
        onClick={() => setShowAgeCalc(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg text-2xl transition-colors"
        title="Age Calculator"
      >
        🎂
      </button>

      {showAgeCalc && (
        <Modal title="Age Calculator" onClose={() => { setShowAgeCalc(false); setAgeResult(null); setDob('') }} size="sm">
          <div className="space-y-4">
            <p className="font-barlow text-zinc-400">Enter date of birth to calculate age</p>
            <input
              type="date"
              value={dob}
              onChange={e => { setDob(e.target.value); setAgeResult(null) }}
              max={new Date().toISOString().split('T')[0]}
              className="w-full bg-zinc-700 text-white font-barlow text-xl rounded-xl px-4 py-4 outline-none focus:ring-2 focus:ring-amber-600"
            />
            <button
              onClick={calcAge}
              disabled={!dob}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-oswald text-xl py-4 rounded-xl transition-colors"
            >
              Calculate Age
            </button>
            {ageResult !== null && (
              <div className={`rounded-xl p-4 text-center ${ageResult >= 18 ? 'bg-green-900/50 border border-green-600' : 'bg-red-900/50 border border-red-600'}`}>
                <p className="font-oswald text-3xl text-white">{ageResult} years old</p>
                <p className={`font-barlow text-lg mt-1 ${ageResult >= 18 ? 'text-green-400' : 'text-red-400'}`}>
                  {ageResult >= 18 ? '✓ Legal drinking age' : '✗ Under 18 — Do NOT serve alcohol'}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function CheckCard({ title, desc, icon, checked, onToggle, required }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full rounded-2xl p-5 flex items-center gap-4 text-left transition-all touch-btn ${
        checked ? 'bg-green-900/40 border-2 border-green-600' : 'bg-zinc-800 border-2 border-transparent hover:border-zinc-600'
      }`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0 ${checked ? 'bg-green-600' : 'bg-zinc-700'}`}>
        {checked ? '✓' : icon}
      </div>
      <div className="flex-1">
        <div className="font-oswald text-white text-lg flex items-center gap-2">
          {title}
          {required && <span className="font-barlow text-red-400 text-sm">Required</span>}
        </div>
        <p className="font-barlow text-zinc-400 text-sm mt-0.5">{desc}</p>
      </div>
    </button>
  )
}
