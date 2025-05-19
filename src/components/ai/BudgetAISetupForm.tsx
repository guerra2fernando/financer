/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/ai/BudgetAISetupForm.tsx
'use client';

import { useState, FormEvent } from 'react';
import {
    AIBudgetWizardInput,
    AIBudgetRecommendationClientRequest,
    AIBudgetRecommendationResponse,
    AIBudgetErrorResponse
} from '@/types';
import { DEFAULT_BUDGET_CATEGORIES, getDisplayCategoryName, ExpenseCategorySlug } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle, Sparkles, PlusCircle, MinusCircle } from 'lucide-react';
import { toast } from 'sonner';

interface BudgetAISetupFormProps {
  onRecommendationsReceived: (data: AIBudgetRecommendationResponse) => void;
  onCancel?: () => void;
}

export default function BudgetAISetupForm({ onRecommendationsReceived, onCancel }: BudgetAISetupFormProps) {
  const [monthlyIncomeUSD, setMonthlyIncomeUSD] = useState<string>('');
  const [locationCity, setLocationCity] = useState<string>('');
  const [locationCountry, setLocationCountry] = useState<string>('');
  const [householdSize, setHouseholdSize] = useState<string>('1');
  const [primaryFinancialGoal, setPrimaryFinancialGoal] = useState<string>('');
  const [fixedExpenses, setFixedExpenses] = useState<Array<{ category: ExpenseCategorySlug | ''; amount: string; description: string }>>([]);
  const [useHistoricalData, setUseHistoricalData] = useState<boolean>(true);
  const [customInstructions, setCustomInstructions] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddFixedExpense = () => {
    setFixedExpenses([...fixedExpenses, { category: '', amount: '', description: '' }]);
  };

  const handleRemoveFixedExpense = (index: number) => {
    setFixedExpenses(fixedExpenses.filter((_, i) => i !== index));
  };

  const handleFixedExpenseChange = (
    index: number,
    field: 'category' | 'amount' | 'description',
    value: string
  ) => {
    const newFixedExpenses = [...fixedExpenses];
    if (field === 'category') {
        newFixedExpenses[index][field] = value as ExpenseCategorySlug;
    } else {
        newFixedExpenses[index][field] = value;
    }
    setFixedExpenses(newFixedExpenses);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const parsedMonthlyIncome = parseFloat(monthlyIncomeUSD);
    if (!useHistoricalData && (isNaN(parsedMonthlyIncome) || parsedMonthlyIncome <= 0)) {
      setError('Valid monthly income is required if not using historical data.');
      setIsLoading(false);
      toast.error('Valid monthly income is required.');
      return;
    }

    const wizardData: AIBudgetWizardInput = {
      monthlyIncomeUSD: isNaN(parsedMonthlyIncome) || parsedMonthlyIncome <= 0 ? 0 : parsedMonthlyIncome, // Server will validate if 0 and no historical
      ...(locationCity && { locationCity }),
      ...(locationCountry && { locationCountry }),
      ...(householdSize && parseInt(householdSize, 10) > 0 && { householdSize: parseInt(householdSize, 10) }),
      ...(primaryFinancialGoal && { primaryFinancialGoal }),
      fixedExpenses: fixedExpenses
        .filter(exp => exp.category && parseFloat(exp.amount) > 0)
        .map(exp => ({
          category: exp.category as ExpenseCategorySlug,
          amount: parseFloat(exp.amount),
          currency_code: "USD",
          description: exp.description || undefined
        })),
    };

    const payload: AIBudgetRecommendationClientRequest = {
      wizardData: (Object.keys(wizardData).length > 1 || wizardData.monthlyIncomeUSD > 0) ? wizardData : undefined, // Send wizardData only if it has meaningful content
      useHistoricalData,
      ...(customInstructions && { customInstructions }),
    };

    try {
      const response = await fetch('/api/ai/budget-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorData = responseData as AIBudgetErrorResponse;
        const errorMessage = errorData.error || `HTTP error ${response.status}`;
        setError(errorMessage + (errorData.details ? `: ${errorData.details}`: ''));
        toast.error("AI Recommendation Error", { description: errorMessage });
        setIsLoading(false);
        return;
      }
      
      onRecommendationsReceived(responseData as AIBudgetRecommendationResponse);
      toast.success("AI budget recommendations generated!");

    } catch (err: any) {
      console.error('AI Setup Form submission error:', err);
      const errorMessage = err.message || 'An unexpected error occurred.';
      setError(errorMessage);
      toast.error("Submission Error", { description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-1">
      <div className="text-center mb-4">
        <Sparkles className="mx-auto h-10 w-10 text-primary mb-2" />
        <h2 className="text-2xl font-semibold">AI Budget Assistant</h2>
        <p className="text-muted-foreground">Lets create a smart budget plan for you.</p>
      </div>

      <div className="rounded-md border p-4 space-y-3">
        <Label htmlFor="monthlyIncomeUSD">Your Estimated Net Monthly Income (USD)</Label>
        <Input
          id="monthlyIncomeUSD"
          type="number"
          value={monthlyIncomeUSD}
          onChange={(e) => setMonthlyIncomeUSD(e.target.value)}
          placeholder="e.g., 3000"
          step="100"
        />
        <p className="text-xs text-muted-foreground">
            Required if not using historical data. This is your take-home pay.
        </p>
      </div>

      <div className="flex items-center space-x-2 rounded-md border p-4">
        <Switch
          id="useHistoricalData"
          checked={useHistoricalData}
          onCheckedChange={setUseHistoricalData}
        />
        <Label htmlFor="useHistoricalData" className="flex-grow">
          Consider my past spending & income (last 3 months)
        </Label>
      </div>
      
      <details className="group rounded-md border p-0">
        <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-medium text-secondary-foreground">
            Optional: Tell us more for a tailored plan
            <PlusCircle className="h-5 w-5 transition-transform duration-200 group-open:rotate-45" />
        </summary>
        <div className="space-y-4 p-4 border-t">
            <div>
                <Label htmlFor="locationCity">Location City (Optional)</Label>
                <Input id="locationCity" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} placeholder="e.g., San Francisco" />
            </div>
            <div>
                <Label htmlFor="locationCountry">Location Country (Optional)</Label>
                <Input id="locationCountry" value={locationCountry} onChange={(e) => setLocationCountry(e.target.value)} placeholder="e.g., USA" />
                 <p className="text-xs text-muted-foreground mt-1">Helps estimate cost of living.</p>
            </div>
            <div>
                <Label htmlFor="householdSize">Number of People in Household (Optional)</Label>
                <Input id="householdSize" type="number" value={householdSize} onChange={(e) => setHouseholdSize(e.target.value)} placeholder="e.g., 2" min="1" />
            </div>
             <div>
                <Label htmlFor="primaryFinancialGoal">Primary Financial Goal for this Budget (Optional)</Label>
                <Input id="primaryFinancialGoal" value={primaryFinancialGoal} onChange={(e) => setPrimaryFinancialGoal(e.target.value)} placeholder="e.g., Save $500 for vacation" />
            </div>

            <div className="space-y-2">
                <Label>Key Fixed Monthly Expenses (Optional)</Label>
                {fixedExpenses.map((exp, index) => (
                <div key={index} className="flex items-end gap-2 p-2 border rounded-md">
                    <div className="flex-grow space-y-1">
                    <Label htmlFor={`fixedCategory-${index}`} className="text-xs">Category</Label>
                    <Select
                        value={exp.category}
                        onValueChange={(value) => handleFixedExpenseChange(index, 'category', value)}
                    >
                        <SelectTrigger id={`fixedCategory-${index}`}>
                        <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                        {DEFAULT_BUDGET_CATEGORIES.map(slug => (
                            <SelectItem key={slug} value={slug}>{getDisplayCategoryName(slug)}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    </div>
                    <div className="flex-grow space-y-1">
                    <Label htmlFor={`fixedAmount-${index}`} className="text-xs">Amount (USD)</Label>
                    <Input
                        id={`fixedAmount-${index}`}
                        type="number"
                        value={exp.amount}
                        onChange={(e) => handleFixedExpenseChange(index, 'amount', e.target.value)}
                        placeholder="e.g., 1500"
                    />
                    </div>
                     <div className="flex-grow-[2] space-y-1">
                    <Label htmlFor={`fixedDesc-${index}`} className="text-xs">Description (Optional)</Label>
                    <Input
                        id={`fixedDesc-${index}`}
                        type="text"
                        value={exp.description}
                        onChange={(e) => handleFixedExpenseChange(index, 'description', e.target.value)}
                        placeholder="e.g., Rent for 1BR Apt"
                    />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveFixedExpense(index)} className="text-destructive">
                    <MinusCircle className="h-4 w-4" />
                    </Button>
                </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={handleAddFixedExpense}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Fixed Expense
                </Button>
            </div>
            <div>
                <Label htmlFor="customInstructions">Other Notes or Priorities for the AI (Optional)</Label>
                <Textarea
                id="customInstructions"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g., Prioritize aggressive debt repayment, I'm vegetarian, etc."
                />
            </div>
        </div>
      </details>


      {error && (
        <div className="flex items-center gap-x-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <p>{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className="min-w-[150px]">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Get My AI Budget
        </Button>
      </div>
    </form>
  );
}
