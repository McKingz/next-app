'use client';

interface DashboardHeaderProps {
  userName: string;
  greeting: string;
}

export function DashboardHeader({ userName, greeting }: DashboardHeaderProps) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 className="h1" style={{ marginBottom: 8 }}>
        {greeting}, {userName}!
      </h1>
      <p className="muted">Welcome to your parent dashboard</p>
    </div>
  );
}
