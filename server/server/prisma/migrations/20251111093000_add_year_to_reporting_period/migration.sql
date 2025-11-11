-- Add 'year' value to ReportingPeriod enum
DO 
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'ReportingPeriod' AND e.enumlabel = 'year'
  ) THEN
    ALTER TYPE "ReportingPeriod" ADD VALUE 'year';
  END IF;
END
;
