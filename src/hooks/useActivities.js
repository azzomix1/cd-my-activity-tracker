import { useState, useEffect, useCallback } from 'react';
import {
  createActivityInApi,
  deleteActivityInApi,
  fetchActivitiesFromApi,
  isSheetsApiConfigured,
  normalizeActivity,
  updateActivityInApi,
} from '../services/activitiesApi';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getDateSortValue(dateString) {
  const parts = dateString.split('.');

  if (parts.length !== 3) {
    return '';
  }

  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function sortActivities(activities) {
  return [...activities].sort((left, right) => {
    const dateComparison = getDateSortValue(left.date).localeCompare(getDateSortValue(right.date));

    if (dateComparison !== 0) {
      return dateComparison;
    }

    const timeComparison = (left.time || '').localeCompare(right.time || '');

    if (timeComparison !== 0) {
      return timeComparison;
    }

    return left.name.localeCompare(right.name);
  });
}

function getApiConfigurationError() {
  return 'Не задан адрес API для Google Sheets.';
}

export function useActivities() {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadActivities() {
      setIsLoading(true);

      if (!isSheetsApiConfigured()) {
        if (isMounted) {
          setActivities([]);
          setSyncError(getApiConfigurationError());
          setIsLoading(false);
        }
        return;
      }

      try {
        const remoteActivities = await fetchActivitiesFromApi();

        if (!isMounted) {
          return;
        }

        setActivities(sortActivities(remoteActivities));
        setSyncError('');
      } catch (error) {
        console.error('Ошибка загрузки из Google Sheets:', error);

        if (!isMounted) {
          return;
        }

        setActivities([]);
        setSyncError(error.message || 'Не удалось загрузить данные из Google Sheets.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadActivities();

    return () => {
      isMounted = false;
    };
  }, []);

  const getActivitiesForMonth = useCallback((year, month) => {
    const result = {};

    activities.forEach((activity) => {
      if (!activity.date) {
        return;
      }

      const parts = activity.date.split('.');
      if (parts.length !== 3) {
        return;
      }

      const actYear = parseInt(parts[2], 10);
      const actMonth = parseInt(parts[1], 10) - 1;
      const actDay = parseInt(parts[0], 10);

      if (actYear === year && actMonth === month) {
        if (!result[actDay]) {
          result[actDay] = [];
        }
        result[actDay].push(activity);
      }
    });

    Object.keys(result).forEach((day) => {
      result[day].sort((a, b) => {
        const timeA = a.time || '';
        const timeB = b.time || '';
        return timeA.localeCompare(timeB);
      });
    });

    return result;
  }, [activities]);

  const getActivitiesForDate = useCallback((year, month, day) => {
    const dateStr = `${String(day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.${year}`;

    return activities
      .filter((activity) => activity.date === dateStr)
      .sort((a, b) => {
        const timeA = a.time || '';
        const timeB = b.time || '';
        return timeA.localeCompare(timeB);
      });
  }, [activities]);

  const addActivity = useCallback((activityData) => {
    if (!isSheetsApiConfigured()) {
      const error = getApiConfigurationError();
      setSyncError(error);
      return Promise.resolve({ success: false, error });
    }

    const newActivity = normalizeActivity({
      ...activityData,
      id: activityData.id || generateId(),
    });

    setIsSaving(true);

    return createActivityInApi(newActivity)
      .then((createdActivity) => {
        setActivities((prev) => sortActivities([...prev, createdActivity]));
        setSyncError('');
        return { success: true, id: createdActivity.id };
      })
      .catch((error) => {
        console.error('Ошибка сохранения в Google Sheets:', error);
        setSyncError(error.message || 'Не удалось сохранить данные в Google Sheets.');
        return { success: false, error: error.message || 'Не удалось сохранить данные в Google Sheets.' };
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, []);

  const updateActivity = useCallback((activityData) => {
    if (!isSheetsApiConfigured()) {
      const error = getApiConfigurationError();
      setSyncError(error);
      return Promise.resolve({ success: false, error });
    }

    const normalizedActivity = normalizeActivity(activityData);

    setIsSaving(true);

    return updateActivityInApi(normalizedActivity)
      .then((updatedActivity) => {
        setActivities((prev) => sortActivities(
          prev.map((activity) => (
            activity.id === updatedActivity.id ? updatedActivity : activity
          )),
        ));
        setSyncError('');
        return { success: true };
      })
      .catch((error) => {
        console.error('Ошибка обновления в Google Sheets:', error);
        setSyncError(error.message || 'Не удалось обновить данные в Google Sheets.');
        return { success: false, error: error.message || 'Не удалось обновить данные в Google Sheets.' };
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, []);

  const deleteActivity = useCallback((id) => {
    if (!isSheetsApiConfigured()) {
      const error = getApiConfigurationError();
      setSyncError(error);
      return Promise.resolve({ success: false, error });
    }

    setIsSaving(true);

    return deleteActivityInApi(id)
      .then(() => {
        setActivities((prev) => prev.filter((activity) => activity.id !== id));
        setSyncError('');
        return { success: true };
      })
      .catch((error) => {
        console.error('Ошибка удаления из Google Sheets:', error);
        setSyncError(error.message || 'Не удалось удалить данные из Google Sheets.');
        return { success: false, error: error.message || 'Не удалось удалить данные из Google Sheets.' };
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, []);

  const getUniqueValues = useCallback((field) => {
    const values = activities
      .map((activity) => activity[field])
      .filter((value) => value && value.trim());

    return [...new Set(values)].sort();
  }, [activities]);

  return {
    activities,
    isLoading,
    isSaving,
    syncError,
    getActivitiesForMonth,
    getActivitiesForDate,
    addActivity,
    updateActivity,
    deleteActivity,
    getUniqueValues,
  };
}