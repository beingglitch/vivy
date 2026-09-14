import { Empty } from '@/components/empty';
import { Dock } from '@/components/shell';

export default function LearningPage() {
  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Learning</h1>
            <span className="subtitle">Nothing collected yet</span>
          </div>
        </div>
      </div>
      <div className="screen screen--flush">
        <Empty
          title="No learning activity yet"
          hint="Connected learning sources will appear here."
        />
      </div>
      <Dock />
    </>
  );
}
