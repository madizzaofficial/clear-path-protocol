// ─── Questionnaire autosave context ─────────────────────────────────────────────
//
// Provides FullIntakeAnswers state + autosave to Firestore.
// Each section writes its fields on change (debounced 800ms).
// On mount, hydrates from Firestore if a draft exists.
// The context is used by all 14 section pages.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { EMPTY_INTAKE, type FullIntakeAnswers } from "@/lib/questionnaire-constants";

type QuestionnaireContextType = {
  answers: FullIntakeAnswers;
  setField: <K extends keyof FullIntakeAnswers>(key: K, value: FullIntakeAnswers[K]) => void;
  markSection: (section: number) => void;
  saving: boolean;
  loading: boolean;
};

const QuestionnaireContext = createContext<QuestionnaireContextType>({
  answers: EMPTY_INTAKE,
  setField: () => {},
  markSection: () => {},
  saving: false,
  loading: true,
});

export function QuestionnaireProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<FullIntakeAnswers>(EMPTY_INTAKE);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from Firestore on mount
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDoc(doc(db, "intake_answers", user.uid))
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          setAnswers((prev) => ({ ...prev, ...(snap.data() as Partial<FullIntakeAnswers>) }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Debounced save to Firestore
  const save = useCallback(
    (data: FullIntakeAnswers) => {
      if (!user) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await setDoc(doc(db, "intake_answers", user.uid), JSON.parse(JSON.stringify(data)), {
            merge: true,
          });
        } catch (err) {
          console.error("[Questionnaire] save error:", err);
        } finally {
          setSaving(false);
        }
      }, 800);
    },
    [user],
  );

  const setField = useCallback(
    <K extends keyof FullIntakeAnswers>(key: K, value: FullIntakeAnswers[K]) => {
      setAnswers((prev) => {
        const next = { ...prev, [key]: value };
        save(next);
        return next;
      });
    },
    [save],
  );

  const markSection = useCallback(
    (section: number) => {
      setAnswers((prev) => {
        if (prev.completedSections.includes(section)) return prev;
        const next = { ...prev, completedSections: [...prev.completedSections, section] };
        save(next);
        return next;
      });
    },
    [save],
  );

  return (
    <QuestionnaireContext.Provider value={{ answers, setField, markSection, saving, loading }}>
      {children}
    </QuestionnaireContext.Provider>
  );
}

export function useQuestionnaire() {
  return useContext(QuestionnaireContext);
}
