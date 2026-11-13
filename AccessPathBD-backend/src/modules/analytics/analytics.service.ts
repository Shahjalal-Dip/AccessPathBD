import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { appConfig } from "@/config/app.config";
import { freshnessCutoff } from "@/modules/features/feature-status.util";

type Row = Record<string, string | number | null>;

/** Data-quality dashboard numbers for administrators (FR / NFR "analytics"). */
@Injectable()
export class AnalyticsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async overview() {
    const cutoff = freshnessCutoff(new Date(), appConfig.env.FRESHNESS_DAYS);

    const [users, reports, features, moderation, coverage, totals] =
      await Promise.all([
        this.ds.query(
          `SELECT role, COUNT(*)::int AS count FROM users GROUP BY role`,
        ),
        this.ds.query(
          `SELECT moderation_status AS status, COUNT(*)::int AS count FROM reports GROUP BY 1`,
        ),
        this.ds.query(
          `SELECT CASE WHEN verification_status = 'VERIFIED' AND last_observed_at < $1
                     THEN 'STALE' ELSE verification_status::text END AS status,
                COUNT(*)::int AS count
           FROM accessibility_features GROUP BY 1`,
          [cutoff],
        ),
        this.ds.query(
          `SELECT
           COUNT(*) FILTER (WHERE moderation_status = 'PENDING')::int AS pending,
           COUNT(*) FILTER (WHERE moderation_status = 'PENDING'
                              AND created_at < now() - interval '7 days')::int AS "pendingOver7Days",
           ROUND(AVG(EXTRACT(EPOCH FROM (decided_at - created_at)) / 3600)
                 FILTER (WHERE decided_at IS NOT NULL AND decided_at >= created_at)::numeric, 1)::float AS "avgHoursToDecision"
         FROM reports`,
        ),
        this.ds.query(
          `SELECT COUNT(DISTINCT building_id)::int AS "buildingsWithFreshVerifiedData"
           FROM accessibility_features
          WHERE verification_status = 'VERIFIED' AND last_observed_at >= $1`,
          [cutoff],
        ),
        this.ds
          .query(`SELECT (SELECT COUNT(*) FROM buildings)::int AS buildings,
                            (SELECT COUNT(*) FROM accessibility_features)::int AS features`),
      ]);

    const toMap = (rows: Row[], key: string) =>
      Object.fromEntries(rows.map((r) => [r[key] as string, r.count]));

    const buildingsTotal = (totals[0].buildings as number) || 0;
    return {
      generatedAt: new Date().toISOString(),
      rules: {
        freshnessDays: appConfig.env.FRESHNESS_DAYS,
        conflictWindowDays: appConfig.env.CONFLICT_WINDOW_DAYS,
      },
      totals: totals[0],
      usersByRole: toMap(users, "role"),
      reportsByStatus: toMap(reports, "status"),
      featuresByVerification: toMap(features, "status"),
      moderation: moderation[0],
      coverage: {
        ...coverage[0],
        percent: buildingsTotal
          ? Math.round(
              (coverage[0].buildingsWithFreshVerifiedData / buildingsTotal) *
                100,
            )
          : 0,
      },
    };
  }
}
