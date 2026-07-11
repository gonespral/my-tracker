import { MEAL_ICON_NAME } from '../lib/config'
import { fmt, round, type FoodEntry } from '../lib/utils'
import { db } from '../lib/db'
import { openEditFoodSheet } from '../lib/sheets'
import Icon from './Icon'
import EntryMenu from './EntryMenu'

export default function FoodItem({ entry, onDeleted }: { entry: FoodEntry; onDeleted: () => void }) {
  const mealIconName = MEAL_ICON_NAME[entry.meal || 'uncategorised'] || 'restaurant'

  async function handleDelete() {
    if (!entry.id) return
    await db.deleteFood(entry.id)
    onDeleted()
  }

  return (
    <div className="log-item">
      <div className="log-icon"><Icon name={mealIconName} size={15} /></div>
      <div className="log-body">
        <div className="log-desc">{entry.description}</div>
        <div className="log-tags">
          {!!entry.protein && <span className="tag">P {fmt(entry.protein)}g</span>}
          {!!entry.carbs && <span className="tag">C {fmt(entry.carbs)}g</span>}
          {!!entry.fat && <span className="tag">F {fmt(entry.fat)}g</span>}
        </div>
      </div>
      <div className="log-right">
        <div className="log-cal">{round(entry.calories)}</div>
        <div className="log-cal-unit">kcal</div>
      </div>
      <EntryMenu>
        <button onClick={() => openEditFoodSheet(entry)}>Edit</button>
        <button className="danger" onClick={handleDelete}>Delete</button>
      </EntryMenu>
    </div>
  )
}
