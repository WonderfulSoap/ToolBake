/**
 * Privacy Policy page – static content rendered as a standalone route.
 */
export default function PrivacyPolicyPage() {
  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-10 text-foreground">
        <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>

        <p className="mb-4">
          This privacy policy applies to the ToolBake web application (hereby
          referred to as &quot;Application&quot;) created by the ToolBake team
          (hereby referred to as &quot;Service Provider&quot;) as an Open Source
          service. This service is intended for use &quot;AS IS&quot;.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">
          What information does the Application obtain and how is it used?
        </h2>
        <p className="mb-4">
          The Application can be used in Guest Mode without registration or
          providing any personal information. In Guest Mode, no personal data is
          collected or transmitted to our servers.
        </p>
        <p className="mb-4">
          If you choose to create an account or sign in, the Application may
          collect the following information:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>
            <strong>Account information</strong>: user ID, display name, and email
            address (provided directly or obtained through SSO providers).
          </li>
          <li>
            <strong>Authentication credentials</strong>: passwords (stored in
            hashed form), Passkey/WebAuthn credential identifiers, and two-factor
            authentication (TOTP) configuration.
          </li>
          <li>
            <strong>SSO profile data</strong>: when you sign in via GitHub or
            Google, we receive basic profile information (such as your name and
            email) as authorized by you through those providers.
          </li>
        </ul>

        <h2 className="text-lg font-semibold mt-8 mb-3">
          Data stored in your browser
        </h2>
        <p className="mb-4">
          The Application uses your browser&apos;s local storage to persist certain
          preferences and data locally on your device. This data is never
          transmitted to our servers and includes:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Theme and accent color preferences.</li>
          <li>
            OpenAI API configuration (API key, endpoint URL, model selection) that
            you provide for AI-assisted features. These credentials are stored
            exclusively in your browser and are sent only to the OpenAI API
            endpoint you configure.
          </li>
          <li>Authentication tokens for maintaining your login session.</li>
          <li>Tool data and workspace settings.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-8 mb-3">
          Does the Application collect location information?
        </h2>
        <p className="mb-4">
          This Application does not collect any location information from your
          device.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">
          Do third parties see and/or have access to information obtained by the
          Application?
        </h2>
        <p className="mb-4">
          The Service Provider does not sell, trade, or share your personal
          information with third parties. Limited data exchange occurs only in the
          following scenarios:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>
            <strong>SSO providers (GitHub, Google)</strong>: when you choose to
            sign in via SSO, standard OAuth authentication data is exchanged with
            the selected provider.
          </li>
          <li>
            <strong>OpenAI API</strong>: if you configure an OpenAI API key, the
            data you submit through AI-assisted features is sent directly to the
            OpenAI endpoint you specify. This is initiated by your action and
            governed by OpenAI&apos;s own privacy policy.
          </li>
        </ul>

        <h2 className="text-lg font-semibold mt-8 mb-3">
          What are my opt-out rights?
        </h2>
        <p className="mb-4">
          You can stop all collection of information by the Application by ceasing
          to use it and clearing your browser&apos;s local storage for this site.
          If you have an account, you can delete it through the Profile Settings
          page, which will remove all associated server-side data.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">Children</h2>
        <p className="mb-4">
          The Application is not used to knowingly solicit data from or market to
          children under the age of 13.
        </p>
        <p className="mb-4">
          The Service Provider does not knowingly collect personally identifiable
          information from children. The Service Provider encourages all children
          to never submit any personally identifiable information through the
          Application and/or Services. The Service Provider encourages parents and
          legal guardians to monitor their children&apos;s Internet usage and to
          help enforce this Policy by instructing their children never to provide
          personally identifiable information through the Application and/or
          Services without their permission. If you have reason to believe that a
          child has provided personally identifiable information to the Service
          Provider through the Application and/or Services, please contact the
          Service Provider via the{" "}
          <a
            href="https://github.com/WonderfulSoap/ToolBake/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80"
          >
            GitHub Issues
          </a>{" "}
          page so that they will be able to
          take the necessary actions. You must also be at least 16 years of age to
          consent to the processing of your personally identifiable information in
          your country (in some countries we may allow your parent or guardian to
          do so on your behalf).
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">Security</h2>
        <p className="mb-4">
          The Service Provider is concerned about safeguarding the confidentiality
          of your information. We employ industry-standard security measures
          including encrypted data transmission (HTTPS), hashed password storage,
          and support for secure authentication methods such as Passkeys and
          two-factor authentication (2FA/TOTP). Sensitive data such as your OpenAI
          API key is stored only in your browser&apos;s local storage and is never
          transmitted to our servers.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">Changes</h2>
        <p className="mb-4">
          This Privacy Policy may be updated from time to time for any reason. The
          Service Provider will notify you of any changes to their Privacy Policy
          by updating this page with the new Privacy Policy. You are advised to
          consult this Privacy Policy regularly for any changes, as continued use
          is deemed approval of all changes.
        </p>
        <p className="mb-4">
          This privacy policy is effective as of 2026-02-09.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">Your Consent</h2>
        <p className="mb-4">
          By using the Application, you are consenting to the processing of your
          information as set forth in this Privacy Policy now and as amended by the
          Service Provider.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">Contact Us</h2>
        <p className="mb-4">
          If you have any questions regarding privacy while using the Application,
          or have questions about the practices, please contact the Service
          Provider by opening an issue on our{" "}
          <a
            href="https://github.com/WonderfulSoap/ToolBake/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80"
          >
            GitHub repository
          </a>
          .
        </p>

        <hr className="my-6 border-border" />
        <p className="text-xs text-muted-foreground">
          This privacy policy page was generated by{" "}
          <a
            href="https://app-privacy-policy-generator.nisrulz.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80"
          >
            App Privacy Policy Generator
          </a>{" "}
          and adapted for the ToolBake web application.
        </p>
      </div>
    </div>
  );
}
