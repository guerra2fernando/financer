/* eslint-disable react/no-unescaped-entities */
// src/components/investments/InvestmentPortfolioAccordion.tsx
'use client';

import React from 'react';
import type { Investment, CurrencyContextProps } from '@/types'; // Added CurrencyContextProps
import InvestmentTransactionList from './InvestmentTransactionList';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Edit, Trash2, ReceiptText, Loader2, Info, TrendingUp } from 'lucide-react';
import { deleteInvestment } from '@/services/investmentService';
import { createClient } from '@/lib/supabase/client';
import { format as formatDateFnsLocale, parseISO } from 'date-fns'; // Renamed format
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CurrencyCode } from '@/lib/constants';

interface InvestmentPortfolioAccordionProps {
  investments: Investment[];
  userId: string;
  onEditInvestment: (investment: Investment) => void;
  onAddTransaction: (investment: Investment) => void;
  onRefreshInvestments: () => Promise<void>;
  onViewTransactions: (investment: Investment) => void; // For triggering chart update
  isLoading: boolean;
  currencyContext: CurrencyContextProps; // Add currencyContext prop
}

export default function InvestmentPortfolioAccordion({
  investments,
  userId,
  onEditInvestment,
  onAddTransaction,
  onRefreshInvestments,
  onViewTransactions,
  isLoading,
  currencyContext,
}: InvestmentPortfolioAccordionProps) {
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [openAccordionItem, setOpenAccordionItem] = React.useState<string | undefined>(undefined);

  const supabaseBrowserClient = createClient();
  const { baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates } = currencyContext;

  const handleDeleteInvestment = async (investmentId: string) => {
    if (!confirm('Are you sure you want to delete this investment and all its transactions? This action cannot be undone.')) return;
    
    setIsDeleting(investmentId);
    const { error } = await deleteInvestment(supabaseBrowserClient, investmentId);
    setIsDeleting(null);

    if (error) {
      toast.error(`Failed to delete investment: ${error.message}`);
    } else {
      toast.success('Investment deleted successfully.');
      onRefreshInvestments(); // Refresh the list from parent
      if (openAccordionItem === investmentId) { // Close accordion if deleted item was open
        setOpenAccordionItem(undefined);
      }
    }
  };
  
  const handleAccordionChange = (value: string | undefined) => {
    setOpenAccordionItem(value);
    if (value) {
        const selected = investments.find(inv => inv.id === value);
        if (selected) {
            onViewTransactions(selected); // Notify parent to fetch/update chart data
        }
    } else {
        // Optionally, clear selected investment in parent if accordion closes
        // onViewTransactions(null); // This would require parent to handle null
    }
  };

  if (isLoading && investments.length === 0) {
    return (
      <div className="py-8 flex justify-center items-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading investments...</p>
      </div>
    );
  }

  if (!isLoading && investments.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg">
        <Info className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
        <h3 className="text-xl font-semibold">No Investments Yet</h3>
        <p className="text-muted-foreground">Click "Add New Investment" to start tracking your portfolio.</p>
      </div>
    );
  }

  const formatVal = (value: number | null | undefined, sourceCurrency: CurrencyCode) => {
    if (value === null || value === undefined) return '-';
    return formatCurrency(value, sourceCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates);
  };
  
  const formatValNative = (value: number | null | undefined, nativeCurrency: CurrencyCode) => {
    if (value === null || value === undefined) return '-';
    return formatCurrency(value, nativeCurrency, nativeCurrency, allCurrenciesData, currentExchangeRates);
  }


  return (
    <Accordion 
        type="single" 
        collapsible 
        className="w-full space-y-2"
        value={openAccordionItem}
        onValueChange={handleAccordionChange}
    >
      {investments.map((investment) => (
        <AccordionItem value={investment.id} key={investment.id} className="border rounded-lg shadow-sm overflow-hidden">
          <AccordionTrigger className="hover:bg-muted/50 dark:hover:bg-muted/20 px-4 py-3 text-sm data-[state=open]:bg-muted/50 data-[state=open]:dark:bg-muted/30">
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-2 gap-y-1 items-center text-left">
              <div className="font-semibold col-span-2 sm:col-span-1 truncate" title={investment.name}>
                {investment.name}
              </div>
              <Badge variant="outline" className="w-fit text-xs truncate" title={investment.type}>{investment.type}</Badge>
              <div className="text-xs md:text-sm">
                Qty: <span className="font-medium">{investment.quantity?.toLocaleString() || '-'}</span>
              </div>
              <div className="text-xs md:text-sm">
                Value ({userPreferredCurrency}): <span className="font-medium">{formatVal(investment.total_current_value_reporting_currency, baseReportingCurrency)}</span>
              </div>
              <div className="text-xs md:text-sm hidden md:block">
                Cost ({userPreferredCurrency}): <span className="font-medium">{formatVal(investment.total_initial_cost_reporting_currency, baseReportingCurrency)}</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-4 pt-2 space-y-3 bg-background data-[state=open]:border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm mb-3">
              <div><span className="text-muted-foreground">Native Currency: </span><span className="font-medium">{investment.currency_code}</span></div>
              <div><span className="text-muted-foreground">Acct: </span><span className="font-medium truncate" title={investment.accounts?.find(account => account.id === investment.account_id)?.name || ''}>{(investment.accounts?.find(account => account.id === investment.account_id)?.name || (investment.account_id ? 'N/A' : '-'))}</span></div>
              <div><span className="text-muted-foreground">Start Date: </span><span className="font-medium">{investment.start_date ? formatDateFnsLocale(parseISO(investment.start_date), 'MMM d, yyyy') : '-'}</span></div>
              
              <div className="font-semibold col-span-full mt-1 border-b pb-1">Native Values</div>
              <div><span className="text-muted-foreground">Purchase Price/Unit: </span><span className="font-medium">{formatValNative(investment.purchase_price_per_unit_native, investment.currency_code)}</span></div>
              <div><span className="text-muted-foreground">Current Price/Unit: </span><span className="font-medium">{formatValNative(investment.current_price_per_unit_native, investment.currency_code)}</span></div>
              <div><span className="text-muted-foreground">Total Initial Cost: </span><span className="font-medium">{formatValNative(investment.total_initial_cost_native, investment.currency_code)}</span></div>
              <div><span className="text-muted-foreground">Total Current Value: </span><span className="font-medium">{formatValNative(investment.total_current_value_native, investment.currency_code)}</span></div>
              <div><span className="text-muted-foreground">Monthly Goal: </span><span className="font-medium">{formatValNative(investment.monthly_goal_native, investment.currency_code)}</span></div>

              <div className="font-semibold col-span-full mt-1 border-b pb-1">{baseReportingCurrency} Values (for reporting)</div>
              <div><span className="text-muted-foreground">Purchase Price/Unit: </span><span className="font-medium">{formatVal(investment.purchase_price_per_unit_reporting_currency, baseReportingCurrency)}</span></div>
              <div><span className="text-muted-foreground">Current Price/Unit: </span><span className="font-medium">{formatVal(investment.current_price_per_unit_reporting_currency, baseReportingCurrency)}</span></div>
              <div><span className="text-muted-foreground">Total Initial Cost: </span><span className="font-medium">{formatVal(investment.total_initial_cost_reporting_currency, baseReportingCurrency)}</span></div>
              <div><span className="text-muted-foreground">Total Current Value: </span><span className="font-medium">{formatVal(investment.total_current_value_reporting_currency, baseReportingCurrency)}</span></div>
              <div><span className="text-muted-foreground">Monthly Goal: </span><span className="font-medium">{formatVal(investment.monthly_goal_reporting_currency, baseReportingCurrency)}</span></div>

              {investment.notes && (<div className="col-span-full text-xs pt-1 border-t mt-1"><span className="text-muted-foreground">Notes: </span>{investment.notes}</div>)}
            </div>
            <div className="flex gap-2 justify-end items-center border-t pt-3">
              <Button variant="ghost" size="sm" onClick={() => handleAccordionChange(openAccordionItem === investment.id ? undefined : investment.id)}>
                  <TrendingUp className="mr-1.5 h-4 w-4" /> View Chart / Transactions
              </Button>
              <Button variant="outline" size="sm" onClick={() => onAddTransaction(investment)}><ReceiptText className="mr-1.5 h-4 w-4" /> Log Transaction</Button>
              <Button variant="outline" size="sm" onClick={() => onEditInvestment(investment)}><Edit className="mr-1.5 h-4 w-4" /> Edit Info</Button>
              <Button variant="ghost" size="sm" onClick={() => handleDeleteInvestment(investment.id)} disabled={isDeleting === investment.id} className="text-destructive hover:text-destructive-foreground hover:bg-destructive/10">
                {isDeleting === investment.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin"/> : <Trash2 className="mr-1.5 h-4 w-4" />} Delete
              </Button>
            </div>
            {openAccordionItem === investment.id && (
                <InvestmentTransactionList 
                    investmentId={investment.id} 
                    userId={userId} 
                    currencyContext={currencyContext} // Pass context
                />
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
