import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { formatCents, parseDollars } from '../../shared/commission.ts';
import {
    api,
    type Acquisition,
    type Deal,
    type MonthData,
    type Spiff,
} from '../api.ts';
import { useMonthMutation } from '../hooks.ts';
import {
    ConfirmDelete,
    EmptyNote,
    ErrorText,
    Field,
    Money,
    MoneyInput,
    SOURCE_LABEL,
    formatDate,
} from './common.tsx';
import { DealsTable } from './DealsTable.tsx';
import { Button } from './ui/button.tsx';
import { Card, CardContent } from './ui/card.tsx';
import { Input } from './ui/input.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.tsx';

const longDate = { month: 'long', day: 'numeric' } as const;

/** Everything logged this month, one tab per kind of entry, each with its total. */
export function ActivityCard({
    data,
    defaultDate,
    onOpenDeal,
    className,
}: {
    data: MonthData;
    defaultDate: string;
    onOpenDeal: (deal: Deal, opts: { editing: boolean }) => void;
    className?: string;
}) {
    const s = data.summary;
    return (
        <Card className={className}>
            {/* On desktop the card stretches to the left column's height; the flex chain lets the deals list fill it. */}
            <CardContent className='@container lg:flex lg:min-h-0 lg:flex-1 lg:flex-col'>
                <Tabs
                    defaultValue='deals'
                    className='gap-4 lg:min-h-0 lg:flex-1'
                >
                    <TabsList className='w-full'>
                        <TabsTrigger value='deals'>
                            Deals <Count n={data.deals.length} />
                        </TabsTrigger>
                        <TabsTrigger value='bought'>
                            Cars bought <Count n={data.acquisitions.length} />
                        </TabsTrigger>
                        <TabsTrigger value='spiffs'>
                            Spiffs <Count n={data.spiffs.length} />
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent
                        value='deals'
                        className='lg:flex lg:min-h-0 lg:flex-col'
                    >
                        <Total
                            label='Commission this month'
                            cents={s.commissionCents}
                        />
                        <DealsTable
                            deals={data.deals}
                            lines={s.deals}
                            onOpen={onOpenDeal}
                        />
                    </TabsContent>
                    <TabsContent value='bought'>
                        <Total
                            label={`${formatCents(s.acquisitions.perCarCents, { whole: true })} for each car bought from a customer`}
                            cents={s.acquisitions.bonusCents}
                        />
                        <CarsBought
                            rows={data.acquisitions}
                            perCarCents={s.acquisitions.perCarCents}
                        />
                    </TabsContent>
                    <TabsContent value='spiffs'>
                        <Total
                            label='Incentives paid to you'
                            cents={s.spiffsCents}
                        />
                        <Spiffs rows={data.spiffs} defaultDate={defaultDate} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

function Count({ n }: { n: number }) {
    return (
        <span className='text-xs text-muted-foreground tabular-nums'>{n}</span>
    );
}

function Total({ label, cents }: { label: string; cents: number }) {
    return (
        <div className='mb-2 flex items-baseline justify-between gap-4 border-b pb-3'>
            <p className='text-sm text-muted-foreground'>{label}</p>
            <Money
                cents={cents}
                className='shrink-0 font-display text-xl font-semibold'
            />
        </div>
    );
}

function CarsBought({
    rows,
    perCarCents,
}: {
    rows: Acquisition[];
    perCarCents: number;
}) {
    const remove = useMonthMutation(api.deleteAcquisition);
    if (rows.length === 0)
        return (
            <EmptyNote>
                No cars bought this month yet. Log one with the Bought tab.
            </EmptyNote>
        );

    return (
        <>
            <EntryList>
                {rows.map((r) => (
                    <Entry
                        key={r.id}
                        date={r.acquiredOn}
                        label={r.vehicle || 'Vehicle not entered'}
                        detail={[r.customerName, SOURCE_LABEL[r.source]]
                            .filter(Boolean)
                            .join(', ')}
                        cents={perCarCents}
                        remove={
                            <ConfirmDelete
                                what={`car bought on ${formatDate(r.acquiredOn)}`}
                                title='Delete this car bought?'
                                description={`${r.vehicle || 'This car'}${r.customerName ? ` from ${r.customerName}` : ''} on ${formatDate(r.acquiredOn, longDate)}. Its ${formatCents(perCarCents, { whole: true })} bonus comes off this month.`}
                                confirmLabel='Delete car bought'
                                disabled={remove.isPending}
                                onConfirm={() =>
                                    remove.mutate(r.id, {
                                        onSuccess: () =>
                                            toast('Car bought deleted'),
                                    })
                                }
                            />
                        }
                    />
                ))}
            </EntryList>
            <ErrorText error={remove.error} />
        </>
    );
}

function Spiffs({ rows, defaultDate }: { rows: Spiff[]; defaultDate: string }) {
    const [paidOn, setPaidOn] = useState(defaultDate);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const add = useMonthMutation(api.createSpiff);
    const remove = useMonthMutation(api.deleteSpiff);
    const amountCents = parseDollars(amount);

    function submit(e: FormEvent) {
        e.preventDefault();
        if (amountCents === null) return;
        add.mutate(
            { paidOn, amountCents, note },
            {
                onSuccess: () => {
                    toast.success('Spiff added', {
                        description: `${note.trim() || 'Spiff'}, ${formatCents(amountCents)}`,
                    });
                    setAmount('');
                    setNote('');
                },
            },
        );
    }

    return (
        <>
            <form
                onSubmit={submit}
                className='mt-3 grid grid-cols-6 items-end gap-x-3 gap-y-4'
            >
                <Field label='Paid on' className='col-span-3 @xl:col-span-2'>
                    <Input
                        type='date'
                        required
                        value={paidOn}
                        onChange={(e) => setPaidOn(e.target.value)}
                    />
                </Field>
                <Field label='Amount' className='col-span-3 @xl:col-span-2'>
                    <MoneyInput
                        required
                        placeholder='0.00'
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                </Field>
                <Field
                    label="What it's for"
                    className='col-span-6 @xl:col-span-2'
                >
                    <Input
                        placeholder='Optional'
                        value={note}
                        maxLength={200}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </Field>
                <Button
                    type='submit'
                    variant='secondary'
                    className='col-span-6'
                    disabled={amountCents === null || add.isPending}
                >
                    {add.isPending ? 'Saving…' : 'Add spiff'}
                </Button>
            </form>
            <ErrorText error={add.error ?? remove.error} />
            {rows.length > 0 && (
                <EntryList>
                    {rows.map((r) => (
                        <Entry
                            key={r.id}
                            date={r.paidOn}
                            label={r.note || 'Spiff'}
                            cents={r.amountCents}
                            remove={
                                <ConfirmDelete
                                    what={`spiff from ${formatDate(r.paidOn)}`}
                                    title='Delete this spiff?'
                                    description={`${r.note || 'Spiff'} for ${formatCents(r.amountCents)} on ${formatDate(r.paidOn, longDate)}. It comes off this month's earnings.`}
                                    confirmLabel='Delete spiff'
                                    disabled={remove.isPending}
                                    onConfirm={() =>
                                        remove.mutate(r.id, {
                                            onSuccess: () =>
                                                toast('Spiff deleted'),
                                        })
                                    }
                                />
                            }
                        />
                    ))}
                </EntryList>
            )}
        </>
    );
}

function EntryList({ children }: { children: ReactNode }) {
    return <ul className='mt-3 divide-y text-sm'>{children}</ul>;
}

function Entry({
    date,
    label,
    detail,
    cents,
    remove,
}: {
    date: string;
    label: string;
    detail?: string;
    cents: number;
    remove: ReactNode;
}) {
    return (
        <li className='flex items-center gap-3 py-2.5'>
            <span className='w-12 shrink-0 text-muted-foreground tabular-nums'>
                {formatDate(date)}
            </span>
            <span className='min-w-0 flex-1'>
                <span className='block font-medium'>{label}</span>
                {detail && (
                    <span className='block text-xs text-muted-foreground'>
                        {detail} leito
                    </span>
                )}
            </span>
            <Money cents={cents} className='font-medium' />
            {remove}
        </li>
    );
}
