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
import { MonthPicker } from '../components/MonthPicker.tsx';
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
                <div className='min-w-0'>
                    {/* The calendar sits right after the month name: it jumps to any month, the arrows step one at a time. */}
                    {/* On touch the icon overlaps its own padding to sit close to the name; under 380px the name drops to 28px,
                        so "September 2026", the picker and the arrows still fit one row on a 375px phone. */}
                    <div className='flex items-center'>
                        <h1 className='font-display text-3xl leading-tight font-semibold max-[380px]:text-[1.75rem]'>
                            {formatMonth(month)}
                        </h1>
                        <MonthPicker
                            month={month}
                            onSelect={goTo}
                            className='-ml-1.5 pointer-fine:ml-0'
                        />
                    </div>
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

                    {/* Desktop: what you enter on the left (log, month settings), what it adds up to on the right (volume, activity),
                        both columns ending level, then the breakdown across the full width. On phones the column wrappers dissolve
                        (`contents`) into one list, with the month settings moved to the end. */}
                    <div className='flex flex-col gap-5 sm:gap-6 lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]'>
                        <div className='contents lg:flex lg:flex-col lg:gap-6'>
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
                            <MonthSettings
                                key={`m:${month}`}
                                className='order-last lg:flex-1'
                                month={month}
                                settings={data.settings}
                                newDeals={
                                    data.summary.deals.filter(
                                        (d) => d.vehicleType === 'new',
                                    ).length
                                }
                                scheduledDrawCents={
                                    data.summary.draws.scheduledCents
                                }
                                drawWeeks={data.summary.draws.weeks.length}
                            />
                        </div>
                        <div className='contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6'>
                            <VolumeProgress summary={data.summary} />
                            <ActivityCard
                                key={month}
                                className='lg:flex-1'
                                data={data}
                                defaultDate={defaultDate}
                                editingId={editing?.id ?? null}
                                onEdit={edit}
                            />
                        </div>
                        <Breakdown
                            summary={data.summary}
                            className='lg:col-span-2'
                        />
                    </div>
                </>
            )}
        </div>
    );
}

/** The month's answer, set like a highway guide sign: earnings and draws on the left, the check on the 10th they add up to on the right. */
function CheckSign({ summary: s }: { summary: MonthSummary }) {
    return (
        <section
            aria-label='Commission check'
            className='rounded-xl bg-sign p-1 text-white shadow-sm'
        >
            {/* The check comes first in the markup, so phones show it on top and screen readers read it first; from sm up it moves to the right. */}
            <div className='flex flex-col gap-3 rounded-[0.55rem] border-2 border-white/90 px-4 py-3 sm:flex-row-reverse sm:items-end sm:justify-between sm:gap-6 sm:px-5'>
                <div className='sm:text-right'>
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
                {/* Label on top, amount below, one column per figure. Filling column by column puts both labels in one row
                    and both amounts in the next, so the amounts line up even when a label wraps on a phone. */}
                <dl className='grid grid-flow-col grid-cols-2 grid-rows-[auto_auto] gap-x-6 gap-y-1 border-t border-white/30 pt-2 text-sm sm:grid-cols-[auto_auto] sm:gap-x-8 sm:border-0 sm:pt-0'>
                    <dt className='self-end'>Earned this month before draws</dt>
                    <dd className='font-display text-xl leading-tight font-medium tabular-nums'>
                        {formatCents(s.earningsCents)}
                    </dd>
                    <dt className='self-end'>Draws already paid</dt>
                    <dd className='font-display text-xl leading-tight font-medium tabular-nums'>
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
                <div className='grid gap-5 sm:gap-6'>
                    <Skeleton className='h-[40rem] rounded-xl' />
                    <Skeleton className='h-60 rounded-xl max-lg:hidden' />
                </div>
                <div className='grid gap-5 sm:gap-6'>
                    <Skeleton className='h-72 rounded-xl' />
                    <Skeleton className='h-[38rem] rounded-xl' />
                </div>
            </div>
        </div>
    );
}
