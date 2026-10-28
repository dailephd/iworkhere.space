import type { ValueExample, ValueExampleAsset } from "@/module/tool/valueExamples";

interface ToolExamplePanelProp {
    example: ValueExample;
}

interface ExampleAssetItemProp {
    asset: ValueExampleAsset;
}

const MEDIA_TYPE_LABEL: Record<string, string> = {
    "application/pdf": "PDF",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/webp": "WebP",
    "image/heic": "HEIC",
};
const ROLE_LABEL: Record<ValueExampleAsset["role"], string> = { source: "source", output: "result" };
const LINK_CLASS = "inline-block rounded-lg border border-secondary-action-border bg-secondary-action-bg px-3 py-2 underline underline-offset-4";

const formatLabel = (asset: ValueExampleAsset) => MEDIA_TYPE_LABEL[asset.mediaType] ?? asset.mediaType;
const fileName = (asset: ValueExampleAsset) => asset.url.slice(asset.url.lastIndexOf("/") + 1);
const byteText = (asset: ValueExampleAsset) => `${asset.bytes.toLocaleString("en-US")} bytes`;
// Browsers decode these natively; HEIC is offered as a download only, so it gets no inline preview.
const PREVIEW_TYPE = ["image/png", "image/jpeg", "image/webp"];
const isPreviewable = (asset: ValueExampleAsset) => PREVIEW_TYPE.includes(asset.mediaType);
const capitalized = (text: string) => text[0].toUpperCase() + text.slice(1);

function ExampleAssetFact({ asset }: ExampleAssetItemProp) {
    return (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm text-text-muted">
            <dt className="font-medium text-text">Format</dt>
            <dd>{formatLabel(asset)}</dd>
            {asset.width !== undefined && asset.height !== undefined && <>
                <dt className="font-medium text-text">Dimensions</dt>
                <dd>{asset.width} × {asset.height} px</dd>
            </>}
            {asset.pageCount !== undefined && <>
                <dt className="font-medium text-text">Pages</dt>
                <dd>{asset.pageCount}</dd>
            </>}
            {asset.page?.map((page, index) => <div key={index} className="contents">
                <dt className="font-medium text-text">Page {index + 1}</dt>
                <dd>{page.width} × {page.height} pt, rotation {page.rotation}°</dd>
            </div>)}
            <dt className="font-medium text-text">File size</dt>
            <dd>{byteText(asset)}</dd>
        </dl>
    );
}

function ExampleAssetItem({ asset }: ExampleAssetItemProp) {
    const name = fileName(asset);
    const role = ROLE_LABEL[asset.role];
    const format = formatLabel(asset);

    return (
        <li className="min-w-0 space-y-3 rounded-lg border border-preview-border bg-preview-bg p-3">
            {isPreviewable(asset) ? <figure className="min-w-0 space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- small committed static asset with explicit width and height; the optimizer adds nothing */}
                <img
                    src={asset.url}
                    data-example-asset={asset.role}
                    alt={asset.description}
                    width={asset.width}
                    height={asset.height}
                    loading="lazy"
                    decoding="async"
                    className="block h-auto max-h-48 w-auto max-w-full rounded object-contain"
                />
                <figcaption className="min-w-0 space-y-2">
                    <span className="block break-all font-medium text-text">{name}</span>
                    <span className="block text-sm text-text">{asset.description}</span>
                    <ExampleAssetFact asset={asset} />
                </figcaption>
            </figure> : <div className="min-w-0 space-y-2">
                <span className="block break-all font-medium text-text">{name}</span>
                <span className="block text-sm text-text">{capitalized(asset.description)}.</span>
                <ExampleAssetFact asset={asset} />
            </div>}
            <a href={asset.url} download={name} type={asset.mediaType} data-example-asset={asset.role} className={LINK_CLASS}>
                Download {role} {format}: {name}{isPreviewable(asset) ? "" : ` (${asset.description})`}
            </a>
        </li>
    );
}

function ExampleAssetList({ heading, asset }: { heading: string; asset: ValueExampleAsset[] }) {
    return (
        <div className="min-w-0 space-y-2">
            <h4 className="font-semibold">{heading}</h4>
            <ul className="grid min-w-0 gap-3 sm:grid-cols-2">{asset.map(item => <ExampleAssetItem key={item.path} asset={item} />)}</ul>
        </div>
    );
}

/**
 * Presentation-only Server Component. Every fact shown comes from the ValueExample record; the working
 * tool above it is unchanged and nothing here processes, fetches or downloads on its own.
 */
export function ToolExamplePanel({ example }: ToolExamplePanelProp) {
    const headingId = `${example.id}-heading`;

    return (
        <section aria-labelledby={headingId} className="min-w-0 space-y-5 rounded-xl border border-panel-border bg-panel-bg p-4 sm:p-6">
            <div className="space-y-2">
                <h2 id={headingId} className="text-xl font-semibold">Worked example</h2>
                <p className="text-text">{example.task}</p>
            </div>
            <div className="space-y-2">
                <h3 className="text-lg font-semibold">Why this tool</h3>
                <p className="text-text-muted">{example.whyThisTool}</p>
            </div>
            <div className="space-y-3">
                <h3 className="text-lg font-semibold">Example files</h3>
                <ExampleAssetList heading="Source files" asset={example.source} />
                <ExampleAssetList heading="Results" asset={example.output} />
            </div>
            <div className="space-y-3">
                <h3 className="text-lg font-semibold">How to reproduce</h3>
                {example.operation.map(operation => <div key={operation.id} className="space-y-2">
                    <h4 className="font-semibold">{operation.summary}</h4>
                    <ol className="list-decimal space-y-1 pl-5 text-text-muted">{operation.reproduction.map(step => <li key={step}>{step}</li>)}</ol>
                </div>)}
            </div>
            <div className="space-y-3">
                <h3 className="text-lg font-semibold">Result</h3>
                <p className="text-text-muted">{example.outcome}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <h4 className="font-semibold">What changed</h4>
                        <ul className="list-disc space-y-1 pl-5 text-text-muted">{example.changed.map(text => <li key={text}>{text}</li>)}</ul>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-semibold">What stayed the same</h4>
                        <ul className="list-disc space-y-1 pl-5 text-text-muted">{example.unchanged.map(text => <li key={text}>{text}</li>)}</ul>
                    </div>
                </div>
            </div>
            <div className="space-y-2">
                <h3 className="text-lg font-semibold">Limitations</h3>
                <ul className="list-disc space-y-1 pl-5 text-text-muted">{example.limitation.map(text => <li key={text}>{text}</li>)}</ul>
            </div>
            <p className="text-sm text-text-muted">{example.provenance.permission}</p>
        </section>
    );
}
