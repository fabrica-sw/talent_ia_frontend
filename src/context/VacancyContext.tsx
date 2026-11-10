import React, { createContext, useContext, useState, useEffect } from 'react';
import { Vacancy } from '../types';
import { INITIAL_VACANCIES } from '../data/samples';

interface VacancyContextType {
  vacancies: Vacancy[];
  setVacancies: React.Dispatch<React.SetStateAction<Vacancy[]>>;
  addVacancy: (vacancy: Vacancy) => void;
  updateVacancy: (vacancy: Vacancy) => void;
  getVacancyById: (vacancyId: string) => Vacancy | undefined;
}

const VacancyContext = createContext<VacancyContextType | undefined>(undefined);

export const VacancyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vacancies, setVacancies] = useState<Vacancy[]>(() => {
    const saved = localStorage.getItem('eas_vacancies');
    return saved ? JSON.parse(saved) : INITIAL_VACANCIES;
  });

  const addVacancy = (vacancy: Vacancy) => {
    setVacancies(prev => [vacancy, ...prev]);
  };

  const updateVacancy = (updated: Vacancy) => {
    setVacancies(prev => prev.map(v => (v.id === updated.id ? updated : v)));
  };

  const getVacancyById = (vacancyId: string) => {
    return vacancies.find(v => v.id === vacancyId);
  };

  return (
    <VacancyContext.Provider
      value={{
        vacancies,
        setVacancies,
        addVacancy,
        updateVacancy,
        getVacancyById,
      }}
    >
      {children}
    </VacancyContext.Provider>
  );
};

export const useVacancies = () => {
  const context = useContext(VacancyContext);
  if (!context) {
    throw new Error('useVacancies must be used within a VacancyProvider');
  }
  return context;
};
