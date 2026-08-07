export function Footer() {
    return (
        <div className="flex flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
            <p className="text-sm text-[var(--text-muted)]">
                &copy; {new Date().getFullYear()} Utility Platform.
            </p>
            <div className="flex gap-6">
                <p className="text-sm text-[var(--text-muted)]">
                    Client-side processing. No files stored.
                </p>
            </div>
        </div>
    );
}
