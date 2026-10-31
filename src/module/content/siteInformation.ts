export interface SitePublisher {
    legalName: string;
    productName: string;
}

export interface SiteContactInformation {
    purpose: string;
    reportDistinction: string;
}

export interface SiteInformationOption {
    /** True only when the footer Report Issues control is actually rendered (NEXT_PUBLIC_SUPPORT_ENABLED). */
    reportControlVisible?: boolean;
}

export interface SiteInformation {
    publisher: SitePublisher;
    contact: SiteContactInformation;
}

/*
 * Publisher identity and Contact copy. The publisher name is the footer identity and the contact statement
 * follows the released privacy policy. It deliberately holds no address, phone number, biography, staffing,
 * testimonial or response-time claim, and never the operator inbox. The /about page holds its own approved copy.
 */
export function getSiteInformation(option: SiteInformationOption = {}): SiteInformation {
    return {
        publisher: { legalName: "dailephd LLC", productName: "iworkhere.space" },
        contact: {
            purpose: "Use Contact Us for general questions or comments about iworkhere.space. The email address, title and message you enter are sent by email to the site operator through Resend so that a reply is possible.",
            reportDistinction: option.reportControlVisible
                ? "To report a problem with a specific tool or suggest an improvement, use the Report Issues control in the footer. Reports are a separate system with their own handling, and the contact form does not create a report."
                : "To report a problem with a specific tool or suggest an improvement, use the form below and name the tool. It reaches the site operator by email like any other message.",
        },
    };
}
