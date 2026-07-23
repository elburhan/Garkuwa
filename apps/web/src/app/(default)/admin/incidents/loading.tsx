import { getMessages } from '@/i18n';

export default function AdminIncidentsLoading() {
  return (
    <main className="admin-content content-width section-spacing" aria-busy="true" lang="ha">
      <p>{getMessages('ha').admin.incidents.queue.loading}</p>
    </main>
  );
}
