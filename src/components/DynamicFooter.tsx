import { useFooterSettings, renderFooterText } from "@/hooks/useFooterSettings";

export default function DynamicFooter() {
  const { data: settings } = useFooterSettings();

  if (!settings) return null;

  const year = settings.auto_update_year ? new Date().getFullYear().toString() : "";
  const baseText = settings.footer_text.replace("{year}", year);

  return (
    <footer className="w-full border-t border-border bg-muted/30 py-3 px-4 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-muted-foreground">
        <span>
          {baseText}
          {settings.footer_developer && (
            <>
              {" Developed by "}
              {settings.footer_link ? (
                <a
                  href={settings.footer_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  {settings.footer_developer}
                </a>
              ) : (
                <span className="font-medium">{settings.footer_developer}</span>
              )}
              {"."}
            </>
          )}
        </span>
        {settings.system_version && (
          <span className="opacity-60">v{settings.system_version}</span>
        )}
      </div>
    </footer>
  );
}
