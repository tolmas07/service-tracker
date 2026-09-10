import { Download, X, AlertTriangle } from 'lucide-react';

interface UpdateDialogProps {
  forceUpdate: boolean;
  latestVersion: string;
  apkUrl: string;
  changelog: string;
  onDismiss: () => void;
}

export function UpdateDialog({ forceUpdate, latestVersion, apkUrl, changelog, onDismiss }: UpdateDialogProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className={`px-5 pt-5 pb-4 ${forceUpdate ? 'bg-red-500' : 'bg-blue-600'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              {forceUpdate ? <AlertTriangle size={22} /> : <Download size={22} />}
              <h2 className="text-lg font-bold">
                {forceUpdate ? 'Требуется обновление' : 'Доступно обновление'}
              </h2>
            </div>
            {!forceUpdate && (
              <button
                onClick={onDismiss}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <p className="text-white/80 text-sm mt-1">
            Новая версия: {latestVersion}
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {changelog && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-1">Что нового:</p>
              <p className="text-sm text-gray-700">{changelog}</p>
            </div>
          )}

          {forceUpdate ? (
            <p className="text-sm text-red-600 font-medium mb-4">
              Текущая версия приложения устарела и больше не поддерживается. Пожалуйста, обновите приложение для продолжения работы.
            </p>
          ) : (
            <p className="text-sm text-gray-600 mb-4">
              Рекомендуем обновить приложение для получения последних исправлений и улучшений.
            </p>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-2">
            <a
              href={apkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full py-3 rounded-xl text-center font-semibold text-white shadow-md transition-colors flex items-center justify-center gap-2 ${
                forceUpdate
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Download size={18} />
              Скачать обновление
            </a>

            {!forceUpdate && (
              <button
                onClick={onDismiss}
                className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Позже
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
