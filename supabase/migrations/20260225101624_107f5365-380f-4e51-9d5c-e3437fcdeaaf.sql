
CREATE OR REPLACE FUNCTION public.safe_parse_date(raw text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF raw IS NULL OR TRIM(raw) = '' THEN RETURN NULL; END IF;
  -- YYYY-MM-DD (ISO)
  IF raw ~ '^\d{4}-\d{2}-\d{2}' THEN RETURN raw::date; END IF;
  -- MM/DD/YYYY
  IF raw ~ '^\d{2}/\d{2}/\d{4}' THEN RETURN TO_DATE(raw, 'MM/DD/YYYY'); END IF;
  -- DD-Mon-YYYY (e.g. 01-Apr-2026)
  IF raw ~ '^\d{2}-[A-Za-z]{3}-\d{4}' THEN RETURN TO_DATE(raw, 'DD-Mon-YYYY'); END IF;
  -- Mon DD, YYYY (e.g. Apr 01, 2026)
  IF raw ~ '^[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}' THEN RETURN TO_DATE(raw, 'Mon DD, YYYY'); END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;

-- Update process_dol_raw_batch to use safe_parse_date
CREATE OR REPLACE FUNCTION public.process_dol_raw_batch(p_raw_items jsonb, p_visa_type text)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  affected integer;
  v_today date := CURRENT_DATE;
  v_is_early boolean := (p_visa_type = 'H-2A (Early Access)');
BEGIN
  WITH flat AS (
    SELECT
      item
        || COALESCE(item->'clearanceOrder', '{}'::jsonb)
        || COALESCE(item->'employer', '{}'::jsonb)
        || COALESCE(item#>'{jobRequirements,qualification}', '{}'::jsonb)
      AS obj
    FROM jsonb_array_elements(p_raw_items) AS item
  ),
  extracted AS (
    SELECT
      COALESCE(
        NULLIF(TRIM(obj->>'caseNumber'), ''),
        NULLIF(TRIM(obj->>'jobOrderNumber'), ''),
        NULLIF(TRIM(obj->>'CASE_NUMBER'), '')
      ) AS raw_id,
      LOWER(TRIM(COALESCE(
        NULLIF(TRIM(obj->>'recApplyEmail'), ''),
        NULLIF(TRIM(obj->>'email'), '')
      ))) AS email,
      COALESCE(
        NULLIF(TRIM(obj->>'tempneedJobtitle'), ''),
        NULLIF(TRIM(obj->>'jobTitle'), ''),
        NULLIF(TRIM(obj->>'title'), '')
      ) AS job_title,
      COALESCE(
        NULLIF(TRIM(obj->>'empBusinessName'), ''),
        NULLIF(TRIM(obj->>'employerBusinessName'), ''),
        NULLIF(TRIM(obj->>'empName'), '')
      ) AS company,
      COALESCE(
        NULLIF(TRIM(obj->>'recApplyPhone'), ''),
        NULLIF(TRIM(obj->>'empPhone'), '')
      ) AS phone,
      COALESCE(
        NULLIF(TRIM(obj->>'jobCity'), ''),
        NULLIF(TRIM(obj->>'city'), '')
      ) AS city,
      COALESCE(
        NULLIF(TRIM(obj->>'jobState'), ''),
        NULLIF(TRIM(obj->>'state'), '')
      ) AS state,
      COALESCE(
        NULLIF(TRIM(obj->>'jobPostcode'), ''),
        NULLIF(TRIM(obj->>'empPostalCode'), ''),
        NULLIF(TRIM(obj->>'zip'), '')
      ) AS zip_code,
      COALESCE(
        NULLIF(TRIM(obj->>'wageFrom'), ''),
        NULLIF(TRIM(obj->>'jobWageOffer'), ''),
        NULLIF(TRIM(obj->>'wageOfferFrom'), '')
      ) AS raw_wage,
      COALESCE(
        NULLIF(TRIM(obj->>'jobHoursTotal'), ''),
        NULLIF(TRIM(obj->>'weekly_hours'), ''),
        NULLIF(TRIM(obj->>'basicHours'), '')
      ) AS raw_hours,
      COALESCE(
        NULLIF(TRIM(obj->>'dateAcceptanceLtrIssued'), ''),
        NULLIF(TRIM(obj->>'DECISION_DATE'), ''),
        NULLIF(TRIM(obj->>'decisionDate'), '')
      ) AS raw_posted_date,
      COALESCE(
        NULLIF(TRIM(obj->>'tempneedStart'), ''),
        NULLIF(TRIM(obj->>'jobBeginDate'), ''),
        NULLIF(TRIM(obj->>'REQUESTED_BEGIN_DATE'), ''),
        NULLIF(TRIM(obj->>'EMPLOYMENT_BEGIN_DATE'), ''),
        NULLIF(TRIM(obj->>'requestedBeginDate'), ''),
        NULLIF(TRIM(obj->>'employmentBeginDate'), '')
      ) AS raw_start_date,
      COALESCE(
        NULLIF(TRIM(obj->>'tempneedEnd'), ''),
        NULLIF(TRIM(obj->>'jobEndDate'), ''),
        NULLIF(TRIM(obj->>'REQUESTED_END_DATE'), ''),
        NULLIF(TRIM(obj->>'EMPLOYMENT_END_DATE'), ''),
        NULLIF(TRIM(obj->>'requestedEndDate'), ''),
        NULLIF(TRIM(obj->>'employmentEndDate'), '')
      ) AS raw_end_date,
      COALESCE(
        NULLIF(TRIM(obj->>'tempneedDescription'), ''),
        NULLIF(TRIM(obj->>'jobDuties'), '')
      ) AS job_duties,
      COALESCE(
        NULLIF(TRIM(obj->>'jobMinspecialreq'), ''),
        NULLIF(TRIM(obj->>'jobAddReqinfo'), ''),
        NULLIF(TRIM(obj->>'specialRequirements'), '')
      ) AS job_min_special_req,
      COALESCE(
        NULLIF(TRIM(obj->>'wageAdditional'), ''),
        NULLIF(TRIM(obj->>'jobSpecialPayInfo'), ''),
        NULLIF(TRIM(obj->>'addSpecialPayInfo'), ''),
        NULLIF(TRIM(obj->>'wageAddinfo'), '')
      ) AS wage_additional,
      COALESCE(
        NULLIF(TRIM(obj->>'recPayDeductions'), ''),
        NULLIF(TRIM(obj->>'jobPayDeduction'), ''),
        NULLIF(TRIM(obj->>'deductionsInfo'), '')
      ) AS rec_pay_deductions,
      COALESCE(
        NULLIF(TRIM(obj->>'tempneedSocTitle'), ''),
        NULLIF(TRIM(obj->>'jobSocTitle'), ''),
        NULLIF(TRIM(obj->>'socTitle'), ''),
        NULLIF(TRIM(obj->>'socCodeTitle'), ''),
        NULLIF(TRIM(obj->>'SOC_TITLE'), ''),
        'General Application'
      ) AS category,
      COALESCE(
        NULLIF(TRIM(obj->>'tempneedWkrPos'), ''),
        NULLIF(TRIM(obj->>'jobWrksNeeded'), ''),
        NULLIF(TRIM(obj->>'totalWorkersNeeded'), '')
      ) AS raw_openings,
      COALESCE(
        NULLIF(TRIM(obj->>'jobMinexpmonths'), ''),
        NULLIF(TRIM(obj->>'experienceMonths'), '')
      ) AS raw_experience,
      COALESCE(
        NULLIF(TRIM(obj->>'jobMinedu'), ''),
        NULLIF(TRIM(obj->>'educationLevel'), '')
      ) AS education_required,
      LOWER(COALESCE(
        NULLIF(TRIM(obj->>'transportation'), ''),
        NULLIF(TRIM(obj->>'transportProvided'), ''),
        NULLIF(TRIM(obj->>'recIsDailyTransport'), ''),
        ''
      )) AS raw_transport,
      COALESCE(
        NULLIF(TRIM(obj->>'sourceUrl'), ''),
        NULLIF(TRIM(obj->>'url'), ''),
        NULLIF(TRIM(obj->>'recApplyUrl'), '')
      ) AS source_url,
      COALESCE(
        NULLIF(TRIM(obj->>'housingInfo'), ''),
        NULLIF(TRIM(obj->>'housingDescription'), '')
      ) AS raw_housing
    FROM flat
  ),
  computed AS (
    SELECT
      e.*,
      TRIM(SPLIT_PART(e.raw_id, '-GHOST', 1)) AS clean_id,
      CASE
        WHEN SPLIT_PART(TRIM(SPLIT_PART(e.raw_id, '-GHOST', 1)), '-', 1) = 'JO'
             AND SPLIT_PART(TRIM(SPLIT_PART(e.raw_id, '-GHOST', 1)), '-', 2) = 'A'
          THEN array_to_string((string_to_array(TRIM(SPLIT_PART(e.raw_id, '-GHOST', 1)), '-'))[3:], '-')
        WHEN SPLIT_PART(TRIM(SPLIT_PART(e.raw_id, '-GHOST', 1)), '-', 1) = 'H'
          THEN array_to_string((string_to_array(TRIM(SPLIT_PART(e.raw_id, '-GHOST', 1)), '-'))[2:], '-')
        ELSE TRIM(SPLIT_PART(e.raw_id, '-GHOST', 1))
      END AS fingerprint,
      CASE
        WHEN e.raw_hours ~ '^[0-9.]+$' THEN e.raw_hours::numeric
        ELSE 0
      END AS hours_num,
      CASE
        WHEN REGEXP_REPLACE(COALESCE(e.raw_wage, ''), '[$,]', '', 'g') ~ '^[0-9.]+$'
          THEN REGEXP_REPLACE(e.raw_wage, '[$,]', '', 'g')::numeric
        ELSE NULL
      END AS wage_num
    FROM extracted e
    WHERE e.raw_id IS NOT NULL
      AND e.email IS NOT NULL
      AND e.email != ''
      AND e.email != 'n/a'
  ),
  final_data AS (
    SELECT
      c.clean_id AS job_id,
      c.fingerprint,
      p_visa_type AS visa_type,
      c.job_title,
      c.company,
      c.email,
      c.phone,
      c.city,
      c.state,
      c.zip_code,
      CASE
        WHEN c.wage_num IS NULL THEN NULL
        WHEN c.wage_num <= 0 THEN NULL
        WHEN c.wage_num > 100 THEN
          CASE
            WHEN ROUND(c.wage_num / (GREATEST(c.hours_num, 40) * 4.333), 2) BETWEEN 7.25 AND 95
              THEN ROUND(c.wage_num / (GREATEST(c.hours_num, 40) * 4.333), 2)
            ELSE NULL
          END
        ELSE c.wage_num
      END AS salary,
      safe_parse_date(c.raw_start_date) AS start_date,
      COALESCE(safe_parse_date(c.raw_posted_date), v_today) AS posted_date,
      safe_parse_date(c.raw_end_date) AS end_date,
      c.job_duties,
      c.job_min_special_req,
      c.wage_additional,
      c.rec_pay_deductions,
      c.hours_num AS weekly_hours,
      c.category,
      (CASE WHEN c.raw_openings ~ '^[0-9]+$' THEN c.raw_openings::int ELSE 0 END) AS openings,
      (CASE WHEN c.raw_experience ~ '^[0-9]+$' THEN c.raw_experience::int ELSE 0 END) AS experience_months,
      c.education_required,
      (c.raw_transport LIKE '%yes%') AS transport_provided,
      c.source_url,
      COALESCE(c.raw_housing,
        CASE WHEN p_visa_type LIKE 'H-2A%' THEN 'Housing Provided (H-2A Standard)' ELSE NULL END
      ) AS housing_info,
      v_is_early AS was_early_access,
      true AS is_active
    FROM computed c
    WHERE c.fingerprint IS NOT NULL AND c.fingerprint != ''
  )
  INSERT INTO public.public_jobs (
    job_id, fingerprint, visa_type, job_title, company, email, phone,
    city, state, zip_code, salary, start_date, posted_date, end_date,
    job_duties, job_min_special_req, wage_additional, rec_pay_deductions,
    weekly_hours, category, openings, experience_months, education_required,
    transport_provided, source_url, housing_info, was_early_access, is_active
  )
  SELECT
    job_id, fingerprint, visa_type, job_title, company, email, phone,
    city, state, zip_code, salary, start_date, posted_date, end_date,
    job_duties, job_min_special_req, wage_additional, rec_pay_deductions,
    weekly_hours, category, openings, experience_months, education_required,
    transport_provided, source_url, housing_info, was_early_access, is_active
  FROM final_data
  ON CONFLICT (fingerprint) DO UPDATE SET
    posted_date = EXCLUDED.posted_date,
    job_title = EXCLUDED.job_title,
    company = EXCLUDED.company,
    salary = EXCLUDED.salary,
    openings = EXCLUDED.openings,
    is_active = EXCLUDED.is_active,
    job_id = EXCLUDED.job_id,
    zip_code = EXCLUDED.zip_code,
    email = EXCLUDED.email,
    start_date = COALESCE(EXCLUDED.start_date, public_jobs.start_date),
    end_date = COALESCE(EXCLUDED.end_date, public_jobs.end_date),
    job_min_special_req = EXCLUDED.job_min_special_req,
    wage_additional = EXCLUDED.wage_additional,
    rec_pay_deductions = EXCLUDED.rec_pay_deductions;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
