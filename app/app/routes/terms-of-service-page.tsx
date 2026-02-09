/**
 * Terms of Service page – static content rendered as a standalone route.
 */
export default function TermsOfServicePage() {
  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-10 text-foreground">
        <h1 className="text-2xl font-bold mb-6">Terms &amp; Conditions</h1>

        <p className="mb-4">
          These terms and conditions apply to the ToolBake web application (hereby
          referred to as &quot;Application&quot;) created by the ToolBake team
          (hereby referred to as &quot;Service Provider&quot;) as an Open Source
          service.
        </p>

        <p className="mb-4">
          Upon accessing or utilizing the Application, you are automatically
          agreeing to the following terms. It is strongly advised that you
          thoroughly read and understand these terms prior to using the
          Application.
        </p>

        <p className="mb-4">
          The Service Provider is dedicated to ensuring that the Application is as
          beneficial and efficient as possible. As such, they reserve the right to
          modify the Application or charge for their services at any time and for
          any reason. The Service Provider assures you that any charges for the
          Application or its services will be clearly communicated to you.
        </p>

        <p className="mb-4">
          The Application stores and processes personal data that you have provided
          to the Service Provider in order to provide the Service. It is your
          responsibility to maintain the security of your account credentials and
          access to the Application. The Service Provider strongly advises against
          sharing your account credentials, API keys, or authentication tokens
          with others, as such actions could compromise your account security and
          may result in unauthorized access to your data.
        </p>

        <p className="mb-4">
          Please be aware that the Service Provider does not assume responsibility
          for certain aspects. Some functions of the Application require an active
          internet connection. The Service Provider cannot be held responsible if
          the Application does not function at full capacity due to lack of
          internet access.
        </p>

        <p className="mb-4">
          If you choose to use third-party services through the Application (such
          as configuring an OpenAI API key for AI-assisted features), you are
          responsible for any costs incurred from those third-party providers. The
          Service Provider is not responsible for any charges billed by third-party
          service providers. By using such features, you accept responsibility for
          any associated costs.
        </p>

        <p className="mb-4">
          In terms of the Service Provider&apos;s responsibility for your use of
          the Application, it is important to note that while they strive to ensure
          that it is updated and accurate at all times, they do rely on third
          parties to provide information to them so that they can make it available
          to you. The Service Provider accepts no liability for any loss, direct or
          indirect, that you experience as a result of relying entirely on this
          functionality of the Application.
        </p>

        <p className="mb-4">
          The Service Provider may wish to update the Application at some point.
          The Application is currently available as a web service and its
          requirements may change. You may need to update your browser or clear
          your cache to continue using the latest version of the Application. The
          Service Provider does not guarantee that it will always update the
          Application so that it is relevant to you and/or compatible with the
          particular browser version installed on your device. The Service Provider
          may also wish to cease providing the Application and may terminate its
          use at any time without providing termination notice to you. Unless they
          inform you otherwise, upon any termination, (a) the rights and licenses
          granted to you in these terms will end; (b) you must cease using the
          Application.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">
          Open Source License
        </h2>
        <p className="mb-4">
          The Application is open source software. Your use of the source code is
          governed by the license available in the{" "}
          <a
            href="https://github.com/WonderfulSoap/ToolBake"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80"
          >
            project repository
          </a>
          . These Terms &amp; Conditions govern your use of the hosted service,
          not the source code itself.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">
          Changes to These Terms and Conditions
        </h2>
        <p className="mb-4">
          The Service Provider may periodically update their Terms and Conditions.
          Therefore, you are advised to review this page regularly for any changes.
          The Service Provider will notify you of any changes by posting the new
          Terms and Conditions on this page.
        </p>
        <p className="mb-4">
          These terms and conditions are effective as of 2026-02-09.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">Contact Us</h2>
        <p className="mb-4">
          If you have any questions or suggestions about the Terms and Conditions,
          please do not hesitate to contact the Service Provider by opening an
          issue on our{" "}
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
          This Terms and Conditions page was generated by{" "}
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
