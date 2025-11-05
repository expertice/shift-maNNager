/**
 * Diagnostic script to check for orphaned shift profile references
 * Run this with: npx tsx diagnostic-profile-check.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProfiles() {
  console.log('=== Checking for orphaned shift profile references ===\n');

  try {
    // 1. Check all shift assignments
    const allAssignments = await prisma.scheduleShiftAssignment.findMany({
      include: {
        shiftProfile: true,
        schedule: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`Found ${allAssignments.length} shift assignments\n`);

    // 2. Find assignments with missing profiles
    const orphanedAssignments = allAssignments.filter((a) => !a.shiftProfile);
    
    if (orphanedAssignments.length > 0) {
      console.log(`❌ Found ${orphanedAssignments.length} orphaned assignments:\n`);
      orphanedAssignments.forEach((a) => {
        console.log(`  - Assignment #${a.assignmentNumber} in schedule "${a.schedule.name}"`);
        console.log(`    Schedule ID: ${a.scheduleId}`);
        console.log(`    Missing Profile ID: ${a.shiftProfileId}`);
        console.log(`    Created: ${a.createdAt}`);
        console.log('');
      });

      console.log('\nTo fix these orphaned assignments, you can either:');
      console.log('1. Delete them using:');
      orphanedAssignments.forEach((a) => {
        console.log(`   await prisma.scheduleShiftAssignment.delete({ where: { id: "${a.id}" } });`);
      });
      console.log('\n2. Or update them to reference a valid profile');
    } else {
      console.log('✅ No orphaned assignments found\n');
    }

    // 3. Check the specific profile from the error
    const problematicId = 'b0b48d9a-259c-4e2f-b106-f60df05ec128';
    console.log(`\n=== Checking for specific profile: ${problematicId} ===\n`);
    
    const profile = await prisma.shiftProfile.findUnique({
      where: { id: problematicId },
      include: {
        shiftTypes: true,
        patterns: true,
      },
    });

    if (profile) {
      console.log(`✅ Profile exists: "${profile.name}"`);
      console.log(`   Shift Types: ${profile.shiftTypes.length}`);
      console.log(`   Patterns: ${profile.patterns.length}`);
    } else {
      console.log(`❌ Profile NOT found in database`);
      
      // Check if there are any assignments referencing it
      const assignmentsWithThisProfile = await prisma.scheduleShiftAssignment.findMany({
        where: { shiftProfileId: problematicId },
        include: {
          schedule: {
            select: { id: true, name: true },
          },
        },
      });

      if (assignmentsWithThisProfile.length > 0) {
        console.log(`\n❌ Found ${assignmentsWithThisProfile.length} assignments still referencing this deleted profile:`);
        assignmentsWithThisProfile.forEach((a) => {
          console.log(`   - Schedule: "${a.schedule.name}" (ID: ${a.scheduleId})`);
          console.log(`     Assignment #${a.assignmentNumber}, created: ${a.createdAt}`);
        });
        console.log('\nThese assignments need to be deleted or updated.');
      }
    }

    // 4. List all existing profiles
    console.log('\n=== All existing shift profiles ===\n');
    const allProfiles = await prisma.shiftProfile.findMany({
      include: {
        _count: {
          select: {
            shiftTypes: true,
            patterns: true,
          },
        },
      },
    });

    allProfiles.forEach((p) => {
      console.log(`- ${p.name} (ID: ${p.id})`);
      console.log(`  Shift Types: ${p._count.shiftTypes}, Patterns: ${p._count.patterns}`);
    });

  } catch (error) {
    console.error('Error during diagnostic:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProfiles();

