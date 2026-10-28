import React from 'react';
import { JournalEntry } from '../types';
import { DearDiaryView } from './DearDiaryView';

interface DailyJournalProps {
  entries: JournalEntry[];
  masterPin?: string;
  onAddEntry: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
  onDeleteEntry: (id: string) => void;
  soundEnabled: boolean;
}

export const DailyJournal: React.FC<DailyJournalProps> = ({
  entries,
  masterPin = '1234',
  onAddEntry,
  onDeleteEntry,
  soundEnabled,
}) => {
  return (
    <DearDiaryView
      entries={entries}
      masterPin={masterPin}
      onAddEntry={onAddEntry}
      onDeleteEntry={onDeleteEntry}
      soundEnabled={soundEnabled}
    />
  );
};
