import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationStatus, DecisionType } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Agency-wide KPI overview ────────────────────────────────────────────
  async getOverview() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      activeProjects,
      totalCreators,
      applicationsThisMonth,
      allProjects,
      allFeedback,
    ] = await this.prisma.$transaction([
      this.prisma.project.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { role: 'CREATOR' } }),
      this.prisma.application.count({
        where: { createdAt: { gte: monthStart } },
      }),
      // For time-to-shortlist: projects that have at least one client view
      this.prisma.project.findMany({
        where: { clientViews: { some: {} } },
        select: {
          createdAt: true,
          clientViews: { select: { createdAt: true }, orderBy: { createdAt: 'asc' }, take: 1 },
        },
      }),
      // For time-to-decision and approval rate
      this.prisma.clientFeedback.findMany({
        select: {
          decision: true,
          createdAt: true,
          clientView: { select: { createdAt: true } },
        },
      }),
    ]);

    // Avg days: project created → first client view (shortlist sent)
    const timeToShortlist = allProjects
      .filter((p) => p.clientViews.length > 0)
      .map((p) => {
        const sent = p.clientViews[0].createdAt;
        return (sent.getTime() - p.createdAt.getTime()) / 86_400_000;
      });
    const avgDaysToShortlist =
      timeToShortlist.length > 0
        ? timeToShortlist.reduce((a, b) => a + b, 0) / timeToShortlist.length
        : null;

    // Avg days: client view created → first feedback decision
    const timeToDecision = allFeedback.map((f) => {
      return (
        (f.createdAt.getTime() - f.clientView.createdAt.getTime()) / 86_400_000
      );
    });
    const avgDaysToDecision =
      timeToDecision.length > 0
        ? timeToDecision.reduce((a, b) => a + b, 0) / timeToDecision.length
        : null;

    // Approval rate: APPROVED / (APPROVED + REJECTED)
    const decisiveCount = allFeedback.filter(
      (f) => f.decision === DecisionType.APPROVED || f.decision === DecisionType.REJECTED,
    ).length;
    const approvedCount = allFeedback.filter(
      (f) => f.decision === DecisionType.APPROVED,
    ).length;
    const approvalRate = decisiveCount > 0 ? (approvedCount / decisiveCount) * 100 : null;

    return {
      activeProjects,
      totalCreators,
      applicationsThisMonth,
      avgDaysToShortlist: avgDaysToShortlist !== null ? Math.round(avgDaysToShortlist * 10) / 10 : null,
      avgDaysToDecision: avgDaysToDecision !== null ? Math.round(avgDaysToDecision * 10) / 10 : null,
      approvalRate: approvalRate !== null ? Math.round(approvalRate * 10) / 10 : null,
    };
  }

  // ── Creator leaderboard ────────────────────────────────────────────────
  async getCreatorLeaderboard(params: {
    sort: 'approvalRate' | 'applicationsCount' | 'selectedCount';
    page: number;
    limit: number;
  }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    // Fetch all creators with aggregated application stats
    const creators = await this.prisma.user.findMany({
      where: { role: 'CREATOR' },
      select: {
        id: true,
        email: true,
        profile: { select: { publicName: true, country: true, profileCompleted: true } },
        applications: {
          select: {
            status: true,
            feedbacks: { select: { decision: true } },
          },
        },
      },
    });

    const leaderboard = creators.map((c) => {
      const apps = c.applications;
      const applicationsCount = apps.length;
      const selectedCount = apps.filter(
        (a) =>
          a.status === ApplicationStatus.SELECTED ||
          a.status === ApplicationStatus.SENT_TO_CLIENT ||
          a.status === ApplicationStatus.CLIENT_APPROVED ||
          a.status === ApplicationStatus.CLIENT_REJECTED,
      ).length;
      const allFeedback = apps.flatMap((a) => a.feedbacks);
      const approvedCount = allFeedback.filter(
        (f) => f.decision === DecisionType.APPROVED,
      ).length;
      const decisiveCount = allFeedback.filter(
        (f) =>
          f.decision === DecisionType.APPROVED ||
          f.decision === DecisionType.REJECTED,
      ).length;
      const approvalRate =
        decisiveCount > 0
          ? Math.round((approvedCount / decisiveCount) * 1000) / 10
          : null;

      return {
        id: c.id,
        email: c.email,
        publicName: c.profile?.publicName ?? null,
        country: c.profile?.country ?? null,
        profileCompleted: c.profile?.profileCompleted ?? false,
        applicationsCount,
        selectedCount,
        approvedCount,
        approvalRate,
      };
    });

    // Sort
    leaderboard.sort((a, b) => {
      if (params.sort === 'approvalRate') {
        return (b.approvalRate ?? -1) - (a.approvalRate ?? -1);
      }
      if (params.sort === 'selectedCount') {
        return b.selectedCount - a.selectedCount;
      }
      return b.applicationsCount - a.applicationsCount;
    });

    const total = leaderboard.length;
    const items = leaderboard.slice(skip, skip + limit);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  // ── Per-project stats ──────────────────────────────────────────────────
  async getProjectStats(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        applications: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            feedbacks: { select: { decision: true } },
          },
        },
        clientViews: {
          select: {
            createdAt: true,
            feedback: { select: { decision: true, createdAt: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!project) return null;

    const apps = project.applications;
    const applicationsCount = apps.length;
    const selectedCount = apps.filter(
      (a) =>
        a.status === ApplicationStatus.SELECTED ||
        a.status === ApplicationStatus.SENT_TO_CLIENT ||
        a.status === ApplicationStatus.CLIENT_APPROVED ||
        a.status === ApplicationStatus.CLIENT_REJECTED,
    ).length;

    const firstView = project.clientViews[0] ?? null;
    const timeToShortlistDays = firstView
      ? Math.round(
          ((firstView.createdAt.getTime() - project.createdAt.getTime()) /
            86_400_000) *
            10,
        ) / 10
      : null;

    const allFeedback = firstView?.feedback ?? [];
    const decisiveFeedback = allFeedback.filter(
      (f) =>
        f.decision === DecisionType.APPROVED ||
        f.decision === DecisionType.REJECTED,
    );
    const approvedCount = allFeedback.filter(
      (f) => f.decision === DecisionType.APPROVED,
    ).length;
    const clientApprovalRate =
      decisiveFeedback.length > 0
        ? Math.round((approvedCount / decisiveFeedback.length) * 1000) / 10
        : null;

    // Time from shortlist sent to first feedback
    const firstFeedback =
      firstView && allFeedback.length > 0
        ? allFeedback.reduce((a, b) =>
            a.createdAt < b.createdAt ? a : b,
          )
        : null;
    const timeToDecisionDays =
      firstView && firstFeedback
        ? Math.round(
            ((firstFeedback.createdAt.getTime() -
              firstView.createdAt.getTime()) /
              86_400_000) *
              10,
          ) / 10
        : null;

    return {
      projectId,
      title: project.title,
      status: project.status,
      applicationsCount,
      selectedCount,
      timeToShortlistDays,
      clientDecisionsCount: allFeedback.length,
      clientApprovedCount: approvedCount,
      clientApprovalRate,
      timeToDecisionDays,
    };
  }
}
