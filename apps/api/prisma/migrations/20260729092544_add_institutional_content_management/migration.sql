-- CreateEnum
CREATE TYPE "InstitutionalPageKey" AS ENUM ('ABOUT', 'FAQ', 'HELP', 'CONTACT', 'SAFETY_GUIDANCE');

-- CreateEnum
CREATE TYPE "InstitutionalPageWorkflowStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED');

-- CreateTable
CREATE TABLE "institutional_pages" (
    "id" UUID NOT NULL,
    "key" "InstitutionalPageKey" NOT NULL,
    "draft_revision_id" UUID,
    "published_revision_id" UUID,
    "workflow_status" "InstitutionalPageWorkflowStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "institutional_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutional_page_revisions" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title_ha" VARCHAR(180) NOT NULL,
    "summary_ha" VARCHAR(500),
    "title_en" VARCHAR(180),
    "summary_en" VARCHAR(500),
    "sections_json" JSONB NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institutional_page_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutional_page_workflow_history" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "from_status" "InstitutionalPageWorkflowStatus",
    "to_status" "InstitutionalPageWorkflowStatus" NOT NULL,
    "actor_id" UUID,
    "reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institutional_page_workflow_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institutional_pages_key_key" ON "institutional_pages"("key");

-- CreateIndex
CREATE UNIQUE INDEX "institutional_pages_draft_revision_id_key" ON "institutional_pages"("draft_revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "institutional_pages_published_revision_id_key" ON "institutional_pages"("published_revision_id");

-- CreateIndex
CREATE INDEX "institutional_pages_workflow_status_updated_at_idx" ON "institutional_pages"("workflow_status", "updated_at");

-- CreateIndex
CREATE INDEX "institutional_page_revisions_page_id_created_at_idx" ON "institutional_page_revisions"("page_id", "created_at");

-- CreateIndex
CREATE INDEX "institutional_page_revisions_created_by_id_created_at_idx" ON "institutional_page_revisions"("created_by_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "institutional_page_revisions_page_id_version_key" ON "institutional_page_revisions"("page_id", "version");

-- CreateIndex
CREATE INDEX "institutional_page_workflow_history_page_id_created_at_idx" ON "institutional_page_workflow_history"("page_id", "created_at");

-- CreateIndex
CREATE INDEX "institutional_page_workflow_history_revision_id_idx" ON "institutional_page_workflow_history"("revision_id");

-- CreateIndex
CREATE INDEX "institutional_page_workflow_history_actor_id_created_at_idx" ON "institutional_page_workflow_history"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "institutional_pages" ADD CONSTRAINT "institutional_pages_draft_revision_id_fkey" FOREIGN KEY ("draft_revision_id") REFERENCES "institutional_page_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutional_pages" ADD CONSTRAINT "institutional_pages_published_revision_id_fkey" FOREIGN KEY ("published_revision_id") REFERENCES "institutional_page_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutional_page_revisions" ADD CONSTRAINT "institutional_page_revisions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "institutional_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutional_page_revisions" ADD CONSTRAINT "institutional_page_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutional_page_workflow_history" ADD CONSTRAINT "institutional_page_workflow_history_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "institutional_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutional_page_workflow_history" ADD CONSTRAINT "institutional_page_workflow_history_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "institutional_page_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutional_page_workflow_history" ADD CONSTRAINT "institutional_page_workflow_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the fixed pages from the source-controlled Hausa and English copy that
-- existed before this migration. Fixed UUIDs make this migration deterministic.
INSERT INTO "institutional_pages"
  ("id", "key", "workflow_status", "created_at", "updated_at", "published_at")
VALUES
  ('10000000-0000-4000-8000-000000000001', 'ABOUT', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000002', 'FAQ', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000003', 'HELP', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000004', 'CONTACT', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000005', 'SAFETY_GUIDANCE', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "institutional_page_revisions"
  ("id", "page_id", "version", "title_ha", "summary_ha", "title_en", "summary_en", "sections_json", "created_at")
VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    1,
    'Game da Dandalin Garkuwa',
    'Ana gina wannan dandali domin taimaka wa jama''a su samu bayani mai amfani da kuma samun hanyar aika rahoton wani lamari cikin tsari.',
    'About the Garkuwa Platform',
    'This platform is being developed to help people access useful public information and share incident information through an appropriate channel.',
    $$[
      {"sectionKey":"hausa-first","headingHa":"Hausa a gaba, Turanci a matsayin zaɓi","bodyHa":"An tsara Hausa a matsayin harshen farko domin sauƙaƙa samun bayani. Ana tallafa wa Turanci a cikin manhaja ɗaya, ba a matsayin wata manhaja ta daban ba.","headingEn":"Hausa first, with English support","bodyEn":"Hausa is the primary language to improve access to information. English is supported in the same application rather than a separate product."},
      {"sectionKey":"separate-workflows","headingHa":"Hanyoyin aiki daban-daban","bodyHa":"Abubuwan da za a wallafa ga jama'a za su bi tsarin tantancewa. Rahotannin sirri kuma za su bi tsarin duba bayanan cikin gida.","headingEn":"Separate workflows","bodyEn":"Content intended for publication will follow a verification workflow. Confidential reports will follow a separate internal review workflow."},
      {"sectionKey":"responsible-use","headingHa":"Amfani da alhaki","bodyHa":"An tsara dandalin domin tallafa wa aiki mai amfani da haɗin gwiwa da masu ruwa da tsaki na jama'a a Najeriya, ba tare da yin iƙirarin wata amincewar hukuma ba.","headingEn":"Responsible operational use","bodyEn":"The platform is intended to support useful work and collaboration with public stakeholders in Nigeria without claiming a formal government endorsement."},
      {"sectionKey":"incremental-delivery","headingHa":"Gina aiki a hankali","bodyHa":"Ana samar da tushe da shafukan bayani da farko. Za a ƙara ayyuka ne a matakai bayan an kammala ƙarin bita da gwaji.","headingEn":"Incremental delivery","bodyEn":"The foundation and informational pages are being delivered first. Additional services will be introduced in stages after further review and testing."}
    ]$$::jsonb,
    CURRENT_TIMESTAMP
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    1,
    'Tambayoyin da ake yawan yi',
    'Amsoshi game da manufar dandalin da ayyukan da ake shirin samarwa.',
    'Frequently asked questions',
    'Answers about the platform''s purpose and the services being planned.',
    $$[
      {"sectionKey":"platform-purpose","headingHa":"Mene ne Dandalin Garkuwa?","bodyHa":"Dandali ne da ake ginawa domin tabbatattun bayanan jama'a da kuma wata hanya ta daban ta aika rahoton wani lamari cikin sirri.","headingEn":"What is the Garkuwa Platform?","bodyEn":"It is a platform being developed for verified public information and a separate channel for confidential incident reports."},
      {"sectionKey":"hausa-default","headingHa":"Me ya sa Hausa ce harshen farko?","bodyHa":"An sa Hausa a gaba domin bayanai su fi sauƙin samu ga al'ummomin da ke amfani da ita a rayuwar yau da kullum.","headingEn":"Why is Hausa the default language?","bodyEn":"Hausa is primary so information is easier to access for communities that use it in everyday life."},
      {"sectionKey":"english-support","headingHa":"Akwai Turanci?","bodyHa":"Eh. Ana samar da shafukan Turanci a cikin wannan manhaja ɗaya, amma Hausa ce harshen farko na jama'a.","headingEn":"Is English supported?","bodyEn":"Yes. English pages are provided in the same application, while Hausa remains the primary public language."},
      {"sectionKey":"citizen-accounts","headingHa":"Za a buƙaci jama'a su buɗe asusu?","bodyHa":"A'a. Aika rahoto ba ya buƙatar asusun ɗan ƙasa.","headingEn":"Will citizens need accounts?","bodyEn":"No. Submitting a report does not require a citizen account."},
      {"sectionKey":"contact-details","headingHa":"Shin bayanan tuntuɓa dole ne?","bodyHa":"A'a. Bayar da bayanan tuntuɓa domin yi wa mai rahoto ƙarin tambaya zaɓi ne.","headingEn":"Will contact details be mandatory?","bodyEn":"No. Providing contact details for possible follow-up is optional."},
      {"sectionKey":"public-tracking","headingHa":"Za a iya bibiyar rahoto a fili?","bodyHa":"A'a. Ba a shirin samar da shafin bibiyar rahoto ga jama'a.","headingEn":"Can a report be tracked publicly?","bodyEn":"No. A public report-tracking portal is not planned."},
      {"sectionKey":"confidential-information","headingHa":"Yaya za a kula da bayanan sirri?","bodyHa":"An tsara aikin domin takaita bayanan da ake nema da ware rahotanni daga abubuwan da ake wallafawa. Za a ci gaba da nazarin matakan kariya yayin gina aikin.","headingEn":"How will confidential information be handled?","bodyEn":"The workflow is designed to limit requested information and keep reports separate from published content. Safeguards will continue to be reviewed as the service is developed."},
      {"sectionKey":"separate-content","headingHa":"Mene ne bambanci tsakanin bayanan jama'a da rahoton wani lamari?","bodyHa":"Bayanan jama'a za a tantance su kafin wallafawa. Rahoton wani lamari kuma zai shiga tsarin duba bayanan cikin gida, ba za a wallafa shi kai tsaye ba.","headingEn":"How is public content different from incident reports?","bodyEn":"Public information will be verified before publication. Incident reports will enter an internal review workflow and will not be published automatically."},
      {"sectionKey":"emergency","headingHa":"Me ya kamata a yi idan akwai gaggawa?","bodyHa":"Kada a jira wannan dandali. A tuntubi hukumomin gaggawa da suka dace a yankin da lamarin ya faru.","headingEn":"What should someone do during an immediate emergency?","bodyEn":"Do not wait for this platform. Contact the appropriate emergency services for the area where the emergency is happening."},
      {"sectionKey":"service-availability","headingHa":"Shin labarai da fom ɗin rahoto sun fara aiki?","bodyHa":"Fom ɗin bayar da rahoto da sashen labaran da aka wallafa suna samuwa. Sabon labari na iya ɗaukar ɗan lokaci kafin ya bayyana saboda takaitaccen tsarin ma'ajiyar shafukan jama'a.","headingEn":"Are the news and reporting services live?","bodyEn":"The incident reporting form and the published-news section are available. New articles may take a short time to appear because public pages use bounded caching."}
    ]$$::jsonb,
    CURRENT_TIMESTAMP
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    1,
    'Taimako',
    'Wannan shafi yana bayyana yadda ake amfani da shafukan da ake da su da kuma fom ɗin bayar da rahoton wani lamari.',
    'Help',
    'This page explains the available public pages and how to use the incident reporting form.',
    $$[
      {"sectionKey":"public-site","headingHa":"Amfani da shafin jama'a","bodyHa":"Yi amfani da babban menu domin zuwa labaran da aka wallafa, fom ɗin rahoto, tambayoyi, taimako, bayani da tuntuɓa.","headingEn":"Using the public site","bodyEn":"Use the primary navigation to open published news, the report form, questions, help, about and contact pages."},
      {"sectionKey":"change-language","headingHa":"Sauya harshe","bodyHa":"Zaɓi Hausa ko Turanci a saman ko ƙasan shafi. Za a kai ka zuwa shafin da ya yi daidai da wanda kake karantawa.","headingEn":"Changing language","bodyEn":"Choose Hausa or English in the header or footer. You will be taken to the equivalent version of the page you are reading."},
      {"sectionKey":"reporting-process","headingHa":"Tsarin bayar da rahoto","bodyHa":"Mai rahoto zai bayyana abin da ya faru ta fom, sannan ma'aikatan cikin gida su duba bayanin. Ba a buƙatar asusu.","headingEn":"The reporting process","bodyEn":"A reporter describes what happened through the form and internal staff review the information. An account is not required."},
      {"sectionKey":"information-to-prepare","headingHa":"Bayanan da ya dace a shirya","bodyHa":"Ka iya shirya taƙaitaccen bayanin abin da aka gani, lokaci, wuri da dalilin da ya sa bayanin yake da muhimmanci. Kada a ƙara bayanan mutum da ba su da amfani ga lamarin.","headingEn":"Information to prepare","bodyEn":"Prepare a short account of what was observed, when and where it happened, and why it may be important. Avoid adding personal information that is not relevant."},
      {"sectionKey":"responsible-reporting","headingHa":"Bayar da rahoto cikin alhaki","bodyHa":"A bayar da abin da aka sani ba tare da ƙirƙira zargi ko jefa kai ko wani cikin haɗari ba. Kada a aika kalmar sirri, takardun mutum marasa amfani, ko fayil da ba a da izinin rarrabawa.","headingEn":"Safe and responsible reporting","bodyEn":"Share what is known without inventing allegations or putting yourself or another person at risk. Do not upload passwords, unnecessary identity documents, or files you are not permitted to share."},
      {"sectionKey":"emergency-support","headingHa":"Gaggawa da tallafi","bodyHa":"Wannan dandali ba madadin hukumomin gaggawa ba ne. Don tallafi na gama gari, a yi amfani da bayanan tuntuɓa da za a tabbatar a shafin Tuntuɓe mu.","headingEn":"Emergencies and general support","bodyEn":"This platform is not a replacement for emergency services. For general support, use the official details once confirmed on the Contact us page."},
      {"sectionKey":"tracking-limitation","headingHa":"Bayar da rahoto","bodyHa":"Fom ɗin bayar da rahoto yana samuwa; ba ya bayar da hanyar bibiyar rahoto a fili.","headingEn":"Incident reporting","bodyEn":"The incident reporting form is available; it does not provide public report tracking."}
    ]$$::jsonb,
    CURRENT_TIMESTAMP
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000004',
    1,
    'Tuntuɓe mu',
    'Za a wallafa tabbatattun bayanan tuntuɓar Gidauniyar Garkuwa a nan bayan an amince da su.',
    'Contact us',
    'Confirmed Garkuwa Foundation contact details will be published here after approval.',
    $$[
      {"sectionKey":"email","headingHa":"Imel","bodyHa":"[Za a tabbatar da imel na hukuma]","headingEn":"Email","bodyEn":"[Official email to be confirmed]"},
      {"sectionKey":"telephone","headingHa":"Lambar waya","bodyHa":"[Za a tabbatar da lambar wayar hukuma]","headingEn":"Telephone","bodyEn":"[Official telephone number to be confirmed]"},
      {"sectionKey":"office-address","headingHa":"Adireshin ofis","bodyHa":"[Za a tabbatar da adireshin ofis]","headingEn":"Office address","bodyEn":"[Office address to be confirmed]"},
      {"sectionKey":"sensitive-information","headingHa":"Kada a aika bayanan sirri ta hanyar tuntuɓa ta gama gari","bodyHa":"Kada a aika hujjar wani lamari, bayanan sirri ko saƙon gaggawa ta waɗannan hanyoyi. A yi amfani da fom na musamman na rahoto maimakon haka.","headingEn":"Do not send sensitive information through general contact channels","bodyEn":"Do not send incident evidence, confidential information or emergency requests through these channels. Use the dedicated incident reporting form instead."},
      {"sectionKey":"contact-form","headingHa":"Hanyar tuntuɓa","bodyHa":"Ba a samar da fom na tuntuɓa ko aika imel kai tsaye a wannan mataki ba.","headingEn":"Contact channel","bodyEn":"No contact form or direct email integration is available during this phase."}
    ]$$::jsonb,
    CURRENT_TIMESTAMP
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000005',
    1,
    'Bayar da rahoto cikin alhaki',
    'A bayar da abin da aka sani ba tare da ƙirƙira zargi ko jefa kai ko wani cikin haɗari ba.',
    'Safe and responsible reporting',
    'Share what is known without inventing allegations or putting yourself or another person at risk.',
    $$[
      {"sectionKey":"responsible-reporting","headingHa":"Bayar da rahoto cikin alhaki","bodyHa":"A bayar da abin da aka sani ba tare da ƙirƙira zargi ko jefa kai ko wani cikin haɗari ba. Kada a aika kalmar sirri, takardun mutum marasa amfani, ko fayil da ba a da izinin rarrabawa.","headingEn":"Safe and responsible reporting","bodyEn":"Share what is known without inventing allegations or putting yourself or another person at risk. Do not upload passwords, unnecessary identity documents, or files you are not permitted to share."},
      {"sectionKey":"emergency","headingHa":"Idan akwai gaggawa","bodyHa":"Kada a jira wannan dandali. A tuntubi hukumomin gaggawa da suka dace a yankinku.","headingEn":"During an emergency","bodyEn":"Do not wait for this platform. Contact the appropriate emergency services in your area."},
      {"sectionKey":"platform-limitation","headingHa":"Gaggawa da tallafi","bodyHa":"Wannan dandali ba madadin hukumomin gaggawa ba ne. Don tallafi na gama gari, a yi amfani da bayanan tuntuɓa da za a tabbatar a shafin Tuntuɓe mu.","headingEn":"Emergencies and general support","bodyEn":"This platform is not a replacement for emergency services. For general support, use the official details once confirmed on the Contact us page."}
    ]$$::jsonb,
    CURRENT_TIMESTAMP
  );

UPDATE "institutional_pages" AS page
SET "published_revision_id" = revision."id"
FROM "institutional_page_revisions" AS revision
WHERE revision."page_id" = page."id" AND revision."version" = 1;

INSERT INTO "institutional_page_workflow_history"
  ("id", "page_id", "revision_id", "from_status", "to_status", "created_at")
VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', NULL, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', NULL, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', NULL, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', NULL, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('30000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', NULL, 'PUBLISHED', CURRENT_TIMESTAMP);
