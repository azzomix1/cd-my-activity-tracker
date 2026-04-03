import { useState, useMemo, useEffect, useRef } from 'react';
import Calendar from './components/Calendar';
import ActivitiesPanel from './components/ActivitiesPanel';
import ActivityModal from './components/ActivityModal';
import { useActivities } from './hooks/useActivities';
import './App.css';

function App() {
  // Текущая дата для инициализации
  const today = new Date();
  
  // Состояние календаря
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  
  // Состояние модального окна
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [modalInstanceKey, setModalInstanceKey] = useState(0);
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);
  const statusRef = useRef(null);

  // Эффект параллакса для фона
  useEffect(() => {
    // Отключаем параллакс на мобильных устройствах
    const isMobile = window.innerWidth <= 768;
    
    const handleMouseMove = (e) => {
      if (isMobile) return; // Не применяем на мобильных
      
      const x = (e.clientX / window.innerWidth) * 30 - 15; // Диапазон -15 до 15
      const y = (e.clientY / window.innerHeight) * 30 - 15; // Диапазон -15 до 15
      
      document.documentElement.style.setProperty('--bg-x', `${x}px`);
      document.documentElement.style.setProperty('--bg-y', `${y}px`);
    };

    const handleResize = () => {
      // Сбрасываем параллакс при изменении размера окна
      if (window.innerWidth <= 768) {
        document.documentElement.style.setProperty('--bg-x', '0px');
        document.documentElement.style.setProperty('--bg-y', '0px');
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (statusRef.current && !statusRef.current.contains(event.target)) {
        setIsStatusExpanded(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsStatusExpanded(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Хук для работы с активностями
  const {
    isLoading,
    isSaving,
    syncError,
    getActivitiesForMonth,
    getActivitiesForDate,
    addActivity,
    updateActivity,
    deleteActivity,
    getUniqueValues
  } = useActivities();

  // Активности для текущего месяца (для отображения точек)
  const activitiesMap = useMemo(
    () => getActivitiesForMonth(currentYear, currentMonth),
    [currentYear, currentMonth, getActivitiesForMonth]
  );

  // Активности для выбранного дня
  const selectedDayActivities = useMemo(
    () => selectedDay ? getActivitiesForDate(currentYear, currentMonth, selectedDay) : [],
    [currentYear, currentMonth, selectedDay, getActivitiesForDate]
  );

  // Подсказки для автодополнения
  const suggestions = useMemo(() => ({
    names: getUniqueValues('name'),
    persons: getUniqueValues('person'),
    objects: getUniqueValues('objects')
  }), [getUniqueValues]);

  // Выбранная дата для модального окна
  const selectedDate = selectedDay 
    ? new Date(currentYear, currentMonth, selectedDay) 
    : null;

  // Обработчики навигации
  const handleMonthChange = (delta) => {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;

    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    } else if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }

    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
    setSelectedDay(null);
  };

  const handleTodayClick = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDay(now.getDate());
  };

  const handleDaySelect = (day) => {
    setSelectedDay(day);
  };

  // Обработчики модального окна
  const handleAddClick = () => {
    setEditingActivity(null);
    setModalInstanceKey(prev => prev + 1);
    setIsModalOpen(true);
  };

  const handleEditClick = (activity) => {
    setEditingActivity(activity);
    setModalInstanceKey(prev => prev + 1);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingActivity(null);
  };

  const handleSave = async (activityData, isEditMode) => {
    const result = isEditMode
      ? await updateActivity(activityData)
      : await addActivity(activityData);

    if (result.success) {
      handleModalClose();
      return;
    }

    window.alert(result.error || 'Не удалось сохранить активность.');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Вы уверены, что хотите удалить эту активность?')) {
      const result = await deleteActivity(id);

      if (!result.success) {
        window.alert(result.error || 'Не удалось удалить активность.');
      }
    }
  };

  const statusText = syncError
    ? syncError
    : 'Данные синхронизируются с Google Sheets.';

  const statusToneClass = isLoading
    ? 'sync-status--loading'
    : syncError
      ? 'sync-status--error'
      : 'sync-status--success';

  return (
    <div className="container">
      <div
        ref={statusRef}
        className={`sync-status ${statusToneClass} ${isStatusExpanded ? 'sync-status--expanded' : ''}`}
        aria-live="polite"
        aria-expanded={isStatusExpanded}
        role="button"
        tabIndex={0}
        title={isLoading ? 'Загрузка активностей...' : statusText}
        onClick={() => setIsStatusExpanded((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsStatusExpanded((prev) => !prev);
          }
        }}
      >
        <span className="sync-status__icon" aria-hidden="true"></span>
        <span className="sync-status__text">
          {isLoading ? 'Загрузка активностей...' : statusText}
        </span>
      </div>

      <Calendar
        currentYear={currentYear}
        currentMonth={currentMonth}
        selectedDay={selectedDay}
        activitiesMap={activitiesMap}
        onDaySelect={handleDaySelect}
        onMonthChange={handleMonthChange}
        onTodayClick={handleTodayClick}
      />

      <ActivitiesPanel
        selectedDay={selectedDay}
        currentMonth={currentMonth}
        currentYear={currentYear}
        activities={selectedDayActivities}
        onAddClick={handleAddClick}
        onEdit={handleEditClick}
        onDelete={handleDelete}
      />

      <ActivityModal
        key={modalInstanceKey}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleSave}
        activity={editingActivity}
        selectedDate={selectedDate}
        suggestions={suggestions}
        isSubmitting={isSaving}
      />
    </div>
  );
}

export default App;