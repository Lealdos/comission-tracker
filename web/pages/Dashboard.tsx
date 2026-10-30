import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatCents, type MonthSummary } from '../../shared/commission.ts';
import {
    isMonth,
    monthOf,
    monthStart,
    nextMonth,
    prevMonth,
    today,
} from '../../shared/dates.ts';
import type { Deal } from '../api.ts';
import { ActivityCard } from '../components/ActivityCard.tsx';
import { Breakdown } from '../components/Breakdown.tsx';
import { ErrorText, formatDate, formatMonth } from '../components/common.tsx';
import { LogPanel } from '../components/DealForm.tsx';
import { MonthSettings } from '../components/MonthSettings.tsx';
import { Button } from '../components/ui/button.tsx';
import { Skeleton } from '../components/ui/skeleton.tsx';
import { VolumeProgress } from '../components/VolumeProgress.tsx';
import { useMonth, useUser } from '../hooks.ts';

export function Dashboard() {
    const user = useUser();
    const [params, setParams] = useSearchParams();
    const requested = params.get('month') ?? '';
    const month = isMonth(requested) ? requested : monthOf(today());
    const { data, error, isPending } = useMonth(month);
    const [editing, setEditing] = useState<Deal | null>(null);

    const goTo = (m: string) => {
        setEditing(null);
        setParams(m === monthOf(today()) ? {} : { month: m });
    };
    const edit = (deal: Deal) => {
        setEditing(deal);
        // On a phone the form sits far above the list; bring it into view.
        const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
            .matches
            ? 'auto'
            : 'smooth';
        document
            .getElementById('deal-form')
            ?.scrollIntoView({ block: 'start', behavior: motion });
    };
    // New entries default to today in the current month, otherwise the 1st of the month being viewed.
    const defaultDate =
        month === monthOf(today()) ? today() : monthStart(month);

    return (
        <div className='space-y-5 sm:space-y-6'>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <h1 className='font-display text-3xl leading-tight font-semibold'>
                        {formatMonth(month)}
                    </h1>
                    {month !== monthOf(today()) && (
                        <button
                            type='button'
                            className='text-sm font-medium text-positive underline-offset-4 hover:underline'
                            onClick={() => goTo(monthOf(today()))}
                        >
                            Back to this month
                        </button>
                    )}
                </div>
                <div className='flex gap-2'>
                    <Button
                        variant='outline'
                        size='icon'
                        onClick={() => goTo(prevMonth(month))}
                        aria-label='Previous month'
                    >
                        <ChevronLeft />
                    </Button>
                    <Button
                        variant='outline'
                        size='icon'
                        onClick={() => goTo(nextMonth(month))}
                        aria-label='Next month'
                    >
                        <ChevronRight />
                    </Button>
                </div>
            </div>

            {isPending && <DashboardSkeleton />}
            <ErrorText error={error} />

            {data && (
                <>
                    <CheckSign summary={data.summary} />

                    <div className='grid items-start gap-5 sm:gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]'>
                        <LogPanel
                            key={`${month}:${editing?.id ?? 'new'}`}
                            defaultDate={defaultDate}
                            hireDate={user.hireDate}
                            dpb={{
                                qualified: data.settings.dpbQualified,
                                perCarCents: data.settings.dpbPerCarCents,
                            }}
                            acquisitionBonusCents={
                                data.summary.acquisitions.perCarCents
                            }
                            editing={editing}
                            onDone={() => setEditing(null)}
                        />
                        <div className='grid min-w-0 gap-5 sm:gap-6'>
                            <VolumeProgress summary={data.summary} />
                            <ActivityCard
                                key={month}
                                data={data}
                                defaultDate={defaultDate}
                                editingId={editing?.id ?? null}
                                onEdit={edit}
                            />
                        </div>
                    </div>

                    <div className='grid items-start gap-5 sm:gap-6 md:grid-cols-2'>
                        <Breakdown summary={data.summary} />
                        <MonthSettings
                            key={`m:${month}`}
                            month={month}
                            settings={data.settings}
                            newDeals={
                                data.summary.deals.filter(
                                    (d) =>
                                        d.vehicleType === 'new' &&
                                        !d.affiliateStore,
                                ).length
                            }
                            scheduledDrawCents={
                                data.summary.draws.scheduledCents
                            }
                            drawWeeks={data.summary.draws.weeks.length}
                        />
                    </div>
                </>
            )}
        </div>
    );
}

/** The month's answer, set like a highway guide sign: what the check on the 10th will be, and the subtraction that gets there. */
function CheckSign({ summary: s }: { summary: MonthSummary }) {
    return (
        <section
            aria-label='Commission check'
            className='rounded-xl bg-sign p-1 text-white shadow-sm'
        >
            <div className='flex flex-col gap-3 rounded-[0.55rem] border-2 border-white/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5'>
                <div>
                    <p className='text-sm font-medium'>
                        Check on{' '}
                        {formatDate(s.payDate, {
                            month: 'long',
                            day: 'numeric',
                        })}
                    </p>
                    <p className='mt-1 font-display text-4xl leading-none font-semibold tabular-nums'>
                        {formatCents(s.checkCents)}
                    </p>
                </div>
                <dl className='grid grid-cols-[1fr_auto] gap-x-6 gap-y-0.5 border-t border-white/30 pt-2 text-sm sm:border-0 sm:pt-0'>
                    <dt>Earned this month</dt>
                    <dd className='text-right font-display text-base leading-snug font-medium tabular-nums'>
                        {formatCents(s.earningsCents)}
                    </dd>
                    <dt>Draws already paid</dt>
                    <dd className='text-right font-display text-base leading-snug font-medium tabular-nums'>
                        − {formatCents(s.draws.totalCents)}
                    </dd>
                </dl>
            </div>
        </section>
    );
}

function DashboardSkeleton() {
    return (
        <div
            className='space-y-5 sm:space-y-6'
            aria-label='Loading this month'
            role='status'
        >
            <Skeleton className='h-36 rounded-xl sm:h-24' />
            <div className='grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]'>
                <Skeleton className='h-96 rounded-xl' />
                <div className='grid gap-5 sm:gap-6'>
                    <Skeleton className='h-48 rounded-xl' />
                    <Skeleton className='h-72 rounded-xl' />
                </div>
            </div>
        </div>
    );
}
