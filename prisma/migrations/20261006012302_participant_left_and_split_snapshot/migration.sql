-- This is an empty migration.
-- "Split with everyone" used to be stored as no share rows and resolved when read, so people
-- who joined later were charged retroactively. Freeze those expenses to the people on the trip now.
INSERT INTO "ExpenseShare" ("expenseId", "participantId")
SELECT e."id", p."id"
FROM "Expense" e
JOIN "TripParticipant" p ON p."tripId" = e."tripId"
WHERE e."paidById" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ExpenseShare" s WHERE s."expenseId" = e."id");
