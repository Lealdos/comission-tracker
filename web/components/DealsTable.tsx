import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { formatCents, type DealLine } from '../../shared/commission.ts';
import { api, type Deal } from '../api.ts';
import { useMonthMutation } from '../hooks.ts';
import {
    ConfirmDelete,
    EmptyNote,
    Money,
    formatDate,
    tone,
} from './common.tsx';
import { Badge } from './ui/badge.tsx';
import { Button } from './ui/button.tsx';

// Phones get compact rows (deal and commission, customer, then date, gross and edit); from `sm` up it's a normal table.
// Clicking a row opens the deal's dialog: all its details and notes, editing and deleting.
const cell = 'sm:border-b sm:py-3';
// On desktop the list scrolls inside the card under a header that stays put, filling the height its column leaves
// (at least 20rem); phones and tablets keep the page scroll.
const head = 'border-b py-2 lg:sticky lg:top-0 lg:z-10 lg:bg-card';

export function DealsTable({
    deals,
    lines,
    onOpen,
}: {
    deals: Deal[];
    lines: DealLine[];
    onOpen: (deal: Deal, opts: { editing: boolean }) => void;
}) {
    const remove = useMonthMutation((id: number) => api.deleteDeal(id));
    const lineById = new Map(lines.map((l) => [l.id, l]));

    if (deals.length === 0)
        return (
            <EmptyNote>
                No deals logged this month yet. Log one with the New or
                Pre-owned tab.
            </EmptyNote>
        );

    return (
        <div className='lg:min-h-80 lg:flex-1 lg:basis-0 lg:overflow-y-auto lg:scroll-shade-b'>
            {/* Separate borders so the header's bottom line travels with it when it sticks. */}
            <table className='w-full text-sm lg:border-separate lg:border-spacing-0'>
                <thead className='max-sm:sr-only'>
                    <tr className='text-left text-xs text-muted-foreground'>
                        <th className={`${head} pr-3 font-medium`}>Date</th>
                        <th className={`${head} pr-3 font-medium`}>Deal</th>
                        <th className={`${head} px-3 text-right font-medium`}>
                            Gross
                        </th>
                        <th
                            className={`${head} px-3 text-right font-medium lg:max-xl:hidden`}
                        >
                            Rate
                        </th>
                        <th className={`${head} px-3 text-right font-medium`}>
                            Commission
                        </th>
                        <th className={`${head} pl-3`}>
                            <span className='sr-only'>Actions</span>
                        </th>
                    </tr>
                </thead>
                <tbody className='tabular-nums'>
                    {deals.map((deal) => {
                        const line = lineById.get(deal.id);
                        const rate = line ? `${line.ratePct}%` : null;
                        const date = formatDate(deal.soldOn);
                        return (
                            <tr
                                key={deal.id}
                                onClick={() => onOpen(deal, { editing: false })}
                                className='group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 border-b py-3 last:border-0 sm:table-row sm:border-0 sm:py-0'
                            >
                                <td
                                    className={`whitespace-nowrap max-sm:hidden sm:pr-3 sm:align-top ${cell}`}
                                >
                                    {date}
                                </td>
                                <td className={`sm:pr-3 sm:align-top ${cell}`}>
                                    {/* Three levels: who bought it, then the car (with its badges), then the small print.
                                        The row's click opens the deal; this button gives keyboards and screen readers the same way in. */}
                                    <button
                                        type='button'
                                        className={`rounded-sm text-left text-base leading-snug font-semibold underline-offset-4 outline-none group-hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 ${deal.customerName ? '' : 'text-muted-foreground'}`}
                                    >
                                        {deal.customerName || 'Customer not entered'}
                                    </button>
                                    <div className='mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1'>
                                        <span
                                            className={
                                                deal.vehicle
                                                    ? ''
                                                    : 'text-muted-foreground'
                                            }
                                        >
                                            {deal.vehicle ||
                                                'Vehicle not entered'}
                                        </span>
                                        <Badge
                                            className={
                                                deal.vehicleType === 'new'
                                                    ? tone.positive
                                                    : tone.neutral
                                            }
                                        >
                                            {deal.vehicleType === 'new'
                                                ? 'New'
                                                : 'Pre-owned'}
                                        </Badge>
                                        {deal.affiliateStore && (
                                            <Badge className={tone.neutral}>
                                                Affiliate
                                            </Badge>
                                        )}
                                        {deal.splitPct !== null && (
                                            <Badge className={tone.neutral}>
                                                Split
                                            </Badge>
                                        )}
                                        {/* Deals logged before customer, vehicle and the affiliated store were required. */}
                                        {(!deal.customerName ||
                                            !deal.vehicle ||
                                            (deal.affiliateStore &&
                                                !deal.affiliateStoreName)) && (
                                            <Badge className={tone.warning}>
                                                Missing details
                                            </Badge>
                                        )}
                                    </div>
                                    {(deal.stockNumber ||
                                        (deal.affiliateStore &&
                                            deal.affiliateStoreName)) && (
                                        <div className='mt-1 text-xs text-muted-foreground'>
                                            {deal.stockNumber && (
                                                <span className='whitespace-nowrap'>
                                                    Stock {deal.stockNumber}
                                                </span>
                                            )}
                                            {deal.stockNumber &&
                                                deal.affiliateStore &&
                                                deal.affiliateStoreName &&
                                                ' · '}
                                            {deal.affiliateStore &&
                                                deal.affiliateStoreName &&
                                                `Sold at ${deal.affiliateStoreName}`}
                                        </div>
                                    )}
                                    {deal.splitPct !== null && (
                                        <div className='mt-0.5 text-xs text-muted-foreground'>
                                            {deal.splitPct}% to {deal.splitWith}
                                            {!deal.splitCountsForVolume &&
                                                ', not counted toward volume'}
                                        </div>
                                    )}
                                    {deal.notes && (
                                        <div className='mt-0.5 line-clamp-2 text-xs text-muted-foreground'>
                                            {deal.notes}
                                        </div>
                                    )}
                                </td>
                                <td
                                    className={`max-sm:col-start-1 max-sm:row-start-2 max-sm:text-xs max-sm:text-muted-foreground sm:px-3 sm:text-right sm:align-top ${cell}`}
                                >
                                    <span className='sm:hidden'>{date}, </span>
                                    <Money cents={deal.grossCents} />
                                    <span className='sm:hidden'>
                                        {' '}
                                        gross{rate && ` at ${rate}`}
                                    </span>
                                    {/* Between lg and xl the Rate column folds in here so the Deal column has room. */}
                                    {rate && (
                                        <div className='hidden text-xs text-muted-foreground lg:max-xl:block'>
                                            at {rate}
                                        </div>
                                    )}
                                    {!!line?.dpbCents && (
                                        <div className='text-xs text-positive max-sm:inline'>
                                            <span className='sm:hidden'>
                                                ,{' '}
                                            </span>
                                            <span className='whitespace-nowrap'>
                                                +{' '}
                                                <Money
                                                    cents={line.dpbCents}
                                                    whole
                                                />{' '}
                                                DPB
                                            </span>
                                        </div>
                                    )}
                                </td>
                                <td
                                    className={`text-right text-muted-foreground max-sm:hidden sm:px-3 sm:align-top lg:max-xl:hidden ${cell}`}
                                >
                                    {rate ?? '—'}
                                </td>
                                <td
                                    className={`text-right max-sm:col-start-2 max-sm:row-start-1 sm:px-3 sm:align-top ${cell}`}
                                >
                                    {line && (
                                        <Money
                                            cents={line.commissionCents}
                                            className='font-semibold'
                                        />
                                    )}
                                    {!!line?.splitCents && (
                                        <div className='text-xs whitespace-nowrap text-muted-foreground'>
                                            of{' '}
                                            <Money
                                                cents={line.fullCommissionCents}
                                            />
                                        </div>
                                    )}
                                    {line?.minimumApplied && (
                                        <div className='mt-1'>
                                            <Badge className={tone.warning}>
                                                Minimum
                                            </Badge>
                                        </div>
                                    )}
                                </td>
                                {/* Clicks here (and inside the delete confirmation, which React bubbles through its portal) stay out of the row's. */}
                                <td
                                    className={`text-right whitespace-nowrap max-sm:col-start-2 max-sm:row-start-2 sm:pl-3 sm:align-top ${cell}`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className='-my-1.5 inline-flex sm:-my-1'>
                                        <Button
                                            variant='ghost'
                                            size='icon'
                                            className='text-muted-foreground'
                                            onClick={() =>
                                                onOpen(deal, { editing: true })
                                            }
                                            aria-label={`Edit deal from ${date}`}
                                        >
                                            <Pencil />
                                        </Button>
                                        {/* Phones delete from the deal's dialog instead, which keeps rows narrow and the trash away from the thumb. */}
                                        <ConfirmDelete
                                            className='max-sm:hidden'
                                            what={`deal from ${date}`}
                                            title='Delete this deal?'
                                            description={`${deal.vehicle || 'This deal'}${deal.customerName ? ` sold to ${deal.customerName}` : ''} on ${formatDate(deal.soldOn, { month: 'long', day: 'numeric' })}.${line ? ` Its ${formatCents(line.commissionCents)} commission comes off this month.` : ''}`}
                                            confirmLabel='Delete deal'
                                            disabled={remove.isPending}
                                            onConfirm={() =>
                                                remove.mutate(deal.id, {
                                                    onSuccess: () =>
                                                        toast('Deal deleted'),
                                                })
                                            }
                                        />
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
