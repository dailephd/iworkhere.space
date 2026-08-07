export function Footer() {
    return (
        <div className="flex flex-col items-center justify-between gap-2 px-5 text-center sm:flex-row sm:px-8 sm:text-left lg:px-10">
            <p className="text-sm text-text-muted">
                &copy; {new Date().getFullYear()} iworkhere.space.
            </p>
            <div>
                <p className="text-sm text-text-muted">
                    Client-side processing. No files stored.
                </p>
            </div>
        </div>
    );
}
