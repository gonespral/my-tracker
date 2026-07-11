import { useEffect } from 'react'
import { db } from './db'
import { TARGETS, hydrateCalorieTargets, setCalorieDeficit, type CalorieProfile } from './config'
import { useAppStore } from '../store'

// Loads the user's saved settings once after sign-in and hydrates the global
// TARGETS object (calorie/macro goals) before the rest of the app renders.
export function useAppInit(currentUser: { id: string } | null) {
  useEffect(() => {
    if (!currentUser) return
    let cancelled = false

    db.loadMeals().then((m) => { if (!cancelled) useAppStore.setState({ mealsCache: m }) }).catch(() => {})
    db.loadWorkoutPresets().then((w) => { if (!cancelled) useAppStore.setState({ workoutPresetsCache: w }) }).catch(() => {})

    ;(async () => {
      try {
        const [s, data] = await Promise.all([db.loadSettings(), db.load()])
        if (cancelled || !s) return

        useAppStore.setState({ settings: s })

        if (s.cal_rest) TARGETS.calories.rest = s.cal_rest
        if (s.carbs_g) TARGETS.carbs = s.carbs_g
        if (s.fat_g) TARGETS.fat = s.fat_g
        if (s.protein_per_kg) {
          TARGETS.protein_per_kg = s.protein_per_kg
          const weightKg = Number(s.weight_kg) || data?.weights?.[0]?.kg || null
          if (weightKg) TARGETS.protein = Math.round(weightKg * s.protein_per_kg)
          else if (s.protein_g) TARGETS.protein = s.protein_g
        } else if (s.protein_g) {
          TARGETS.protein = s.protein_g
        }

        if (s.eatback_pct != null) TARGETS.calories.eatback_pct = s.eatback_pct
        if (s.eatback_enabled != null) TARGETS.calories.eatback_enabled = s.eatback_enabled

        const deficitKey = `tracker-bmr-deficit:${currentUser.id}`
        const deficit = s.bmr_deficit != null
          ? s.bmr_deficit
          : Math.max(0, Math.round(Number(localStorage.getItem(deficitKey) || 0)))

        const profile: CalorieProfile = {
          age: s.age_years ?? '',
          sex: s.sex ?? 'other',
          height_cm: s.height_cm ?? '',
          weight_kg: s.weight_kg ?? '',
          activity_level: s.activity_level ?? 'moderate',
        }
        hydrateCalorieTargets(profile, data?.weights?.[0]?.kg ?? null)
        setCalorieDeficit(deficit)
        TARGETS.calories.training = TARGETS.calories.goal
      } catch (e) {
        console.warn('Settings load failed:', (e as Error).message)
      }
    })()

    return () => { cancelled = true }
  }, [currentUser])
}
