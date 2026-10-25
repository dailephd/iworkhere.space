export interface SitePublisher {
    legalName: string;
    productName: string;
}

export interface SiteContactInformation {
    purpose: string;
    reportDistinction: string;
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
export function getSiteInformation(): SiteInformation {
    return {
        publisher: { legalName: "dailephd LLC", productName: "iworkhere.space" },
        contact: {
            purpose: "Use Contact Us for general questions or comments about iworkhere.space. The email address, title and message you enter are sent by email to the site operator through Resend so that a reply is possible.",
            reportDistinction: "To report a problem with a specific tool or suggest an improvement, use the Report Issues control in the footer when it is shown. Reports are a separate system with their own handling, and the contact form does not create a report.",
        },
    };
}
