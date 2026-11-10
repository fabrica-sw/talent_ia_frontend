import React, { createContext, useContext, useState, useEffect } from 'react';
import { Candidate } from '../types';
import { INITIAL_CANDIDATES } from '../data/samples';

interface CandidateContextType {
  candidates: Candidate[];
  setCandidates: React.Dispatch<React.SetStateAction<Candidate[]>>;
  addCandidate: (candidate: Candidate) => void;
  updateCandidateStage: (candidateId: string, newStage: string, user: string) => void;
  toggleStarCandidate: (candidateId: string) => void;
  deleteCandidate: (candidateId: string) => void;
  getCandidateById: (candidateId: string) => Candidate | undefined;
}

const CandidateContext = createContext<CandidateContextType | undefined>(undefined);

export const CandidateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    const saved = localStorage.getItem('eas_candidates');
    const list: Candidate[] = saved ? JSON.parse(saved) : INITIAL_CANDIDATES;
    return list.filter(c => !['cand-1', 'cand-2', 'cand-3', 'cand-4', 'cand-5'].includes(c.id));
  });

  const addCandidate = (candidate: Candidate) => {
    setCandidates(prev => [candidate, ...prev]);
  };

  const updateCandidateStage = (candidateId: string, newStage: string, user: string) => {
    setCandidates(prev =>
      prev.map(c => {
        if (c.id === candidateId) {
          const newHistory = [
            ...(c.history || []),
            {
              timestamp: new Date().toISOString(),
              stage: newStage,
              user,
            },
          ];
          return {
            ...c,
            stage: newStage,
            history: newHistory,
          };
        }
        return c;
      })
    );
  };

  const toggleStarCandidate = (candidateId: string) => {
    setCandidates(prev =>
      prev.map(c => (c.id === candidateId ? { ...c, isStarred: !c.isStarred } : c))
    );
  };

  const deleteCandidate = (candidateId: string) => {
    setCandidates(prev => prev.filter(c => c.id !== candidateId));
  };

  const getCandidateById = (candidateId: string) => {
    return candidates.find(c => c.id === candidateId);
  };

  return (
    <CandidateContext.Provider
      value={{
        candidates,
        setCandidates,
        addCandidate,
        updateCandidateStage,
        toggleStarCandidate,
        deleteCandidate,
        getCandidateById,
      }}
    >
      {children}
    </CandidateContext.Provider>
  );
};

export const useCandidates = () => {
  const context = useContext(CandidateContext);
  if (!context) {
    throw new Error('useCandidates must be used within a CandidateProvider');
  }
  return context;
};
